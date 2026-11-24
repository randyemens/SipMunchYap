import { Router, type Request, type Response } from "express";
import { pool } from "../db";

const router = Router();

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const SORT_OPTIONS = ["default", "highest_rated", "most_reviewed", "distance"] as const;
type SortBy = (typeof SORT_OPTIONS)[number];

/** Opaque cursor: sort tag (safeguard) + primary sort value + id tie-breaker. */
type MerchantCursor = { sort: SortBy; v: string | number; id: number };

type ParseCursorResult =
  | { status: "none" }
  | { status: "ok"; cursor: MerchantCursor }
  | { status: "invalid" }
  | { status: "sort_mismatch"; cursorSort: string };

type MerchantListRow = {
  id: number;
  restaurant_name: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number | null;
  longitude: number | null;
  logo_url: string | null;
  neighborhood: string | null;
  slug: string | null;
  sort_value: number | string | null;
  events: unknown;
  merchant_categories: unknown;
  merchant_offers: unknown;
  merchant_google_ratings: unknown;
};

/** Prefer in-app published review avg; else Google rating (excluding no_match). */
const EFFECTIVE_RATING_SQL = `
  COALESCE(
    (
      SELECT AVG(rr.rating)::double precision
      FROM merchant_reviews r
      JOIN merchant_review_ratings rr ON rr.review_id = r.id
      WHERE r.merchant_id = m.id
        AND r.status = 'published'
    ),
    (
      SELECT g.google_rating::double precision
      FROM merchant_google_ratings g
      WHERE g.merchant_id = m.id
        AND g.match_confidence IS DISTINCT FROM 'no_match'
        AND g.google_rating IS NOT NULL
      LIMIT 1
    ),
    0
  )
`;

/** Prefer published in-app review count; else Google review count. */
const EFFECTIVE_REVIEW_COUNT_SQL = `
  COALESCE(
    NULLIF((
      SELECT COUNT(*)::double precision
      FROM merchant_reviews r
      WHERE r.merchant_id = m.id
        AND r.status = 'published'
    ), 0),
    (
      SELECT g.google_review_count::double precision
      FROM merchant_google_ratings g
      WHERE g.merchant_id = m.id
        AND g.match_confidence IS DISTINCT FROM 'no_match'
        AND g.google_review_count IS NOT NULL
      LIMIT 1
    ),
    0
  )
`;

function parseLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(n), MAX_LIMIT);
}

function parseSortBy(raw: unknown): SortBy {
  if (typeof raw === "string" && (SORT_OPTIONS as readonly string[]).includes(raw)) {
    return raw as SortBy;
  }
  return "default";
}

/**
 * Decode opaque cursor. Includes sort tag as a safeguard: reject if it doesn't
 * match request sortBy (client should omit cursor when changing sort).
 */
function parseCursor(raw: unknown, sortBy: SortBy): ParseCursorResult {
  if (typeof raw !== "string" || !raw.trim()) return { status: "none" };
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    const v = parsed.v ?? parsed.name ?? parsed.value;
    if (
      (typeof v !== "string" && typeof v !== "number") ||
      typeof parsed.id !== "number"
    ) {
      return { status: "invalid" };
    }

    const cursorSort =
      typeof parsed.sort === "string"
        ? parsed.sort
        : typeof parsed.s === "string"
          ? parsed.s
          : null;

    // Cursors minted before the sort tag existed: treat as invalid for safety
    if (!cursorSort) return { status: "invalid" };
    if (cursorSort !== sortBy) {
      return { status: "sort_mismatch", cursorSort };
    }
    if (!(SORT_OPTIONS as readonly string[]).includes(cursorSort)) {
      return { status: "invalid" };
    }

    return {
      status: "ok",
      cursor: { sort: cursorSort as SortBy, v, id: parsed.id },
    };
  } catch {
    return { status: "invalid" };
  }
}

function encodeCursor(sortBy: SortBy, row: MerchantListRow): string {
  return Buffer.from(
    JSON.stringify({
      sort: sortBy,
      v: row.sort_value ?? row.restaurant_name,
      id: row.id,
    }),
    "utf8",
  ).toString("base64url");
}

function parseCsv(raw: unknown): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseNumberList(raw: unknown): number[] {
  return parseCsv(raw)
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n));
}

/** Accept "17:00", "17:00:00", or "5:00 PM" → "HH:MM:SS" for Postgres time compare */
function normalizeTime(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const value = raw.trim();

  const ampm = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (ampm) {
    let hours = Number(ampm[1]);
    const minutes = Number(ampm[2]);
    const seconds = Number(ampm[3] ?? "0");
    const meridiem = ampm[4]!.toUpperCase();
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  const twentyFour = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (twentyFour) {
    const hours = Number(twentyFour[1]);
    const minutes = Number(twentyFour[2]);
    const seconds = Number(twentyFour[3] ?? "0");
    if (hours > 23 || minutes > 59 || seconds > 59) return null;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return null;
}

function parseOptionalNumber(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Great-circle distance in miles from the given lat/lng params to each merchant.
 * Same math as the radius filter.
 */
function distanceMilesSql(latParam: string, lngParam: string): string {
  // Rounded to 6 decimals. Postgres returns float8 values with ~15 significant digits,
  // so an unrounded cursor value can sit just below the row's real distance and the
  // keyset "> cursor" check would return that same row again on the next page.
  return `(
    round((
      3959 * acos(
        least(1.0, greatest(-1.0,
          cos(radians(${latParam})) * cos(radians(m.latitude))
          * cos(radians(m.longitude) - radians(${lngParam}))
          + sin(radians(${latParam})) * sin(radians(m.latitude))
        ))
      )
    )::numeric, 6)::double precision
  )`;
}

function sortExpressions(sortBy: SortBy, distanceSql: string | null): {
  selectExpr: string;
  orderBy: string;
} {
  if (sortBy === "distance" && distanceSql) {
    return {
      selectExpr: `${distanceSql} AS sort_value`,
      orderBy: "sort_value ASC, m.id ASC",
    };
  }
  if (sortBy === "highest_rated") {
    return {
      selectExpr: `(${EFFECTIVE_RATING_SQL}) AS sort_value`,
      orderBy: "sort_value DESC, m.id ASC",
    };
  }
  if (sortBy === "most_reviewed") {
    return {
      selectExpr: `(${EFFECTIVE_REVIEW_COUNT_SQL}) AS sort_value`,
      orderBy: "sort_value DESC, m.id ASC",
    };
  }
  return {
    selectExpr: "m.restaurant_name AS sort_value",
    orderBy: "m.restaurant_name ASC, m.id ASC",
  };
}

/**
 * GET /merchants
 *
 * Query params:
 * - limit (default 30, max 100)
 * - cursor (opaque { sort, v, id }; client resets when sortBy changes)
 * - sortBy=default|highest_rated|most_reviewed
 * - search, categoryIds, neighborhood
 * - north,south,east,west / lat,lng,radiusMiles
 * - days, startTime, endTime, offers, menuType, carouselId
 */
/**
 * Keep only the $n parameters a SQL string uses and renumber them from $1.
 * Postgres rejects parameters that are passed but never referenced, and the
 * count query does not use every parameter the page query needed.
 */
function compactParams(sql: string, params: unknown[]): { sql: string; params: unknown[] } {
  const used = [...new Set([...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])))].sort(
    (a, b) => a - b,
  );
  const renumber = new Map(used.map((old, i) => [old, i + 1]));
  return {
    sql: sql.replace(/\$(\d+)/g, (_, n: string) => `$${renumber.get(Number(n))}`),
    params: used.map((n) => params[n - 1]),
  };
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = parseLimit(req.query.limit);
    const sortBy = parseSortBy(req.query.sortBy);
    const cursorResult = parseCursor(req.query.cursor, sortBy);
    if (cursorResult.status === "invalid") {
      res.status(400).json({ error: "invalid cursor" });
      return;
    }
    if (cursorResult.status === "sort_mismatch") {
      res.status(400).json({
        error: "cursor sortBy does not match request sortBy; omit cursor and start from page 1",
        cursorSort: cursorResult.cursorSort,
        sortBy,
      });
      return;
    }
    const cursor =
      cursorResult.status === "ok" ? cursorResult.cursor : null;

    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const categoryIds = parseCsv(req.query.categoryIds);
    const neighborhood =
      typeof req.query.neighborhood === "string" ? req.query.neighborhood.trim() : "";
    const north = parseOptionalNumber(req.query.north);
    const south = parseOptionalNumber(req.query.south);
    const east = parseOptionalNumber(req.query.east);
    const west = parseOptionalNumber(req.query.west);
    const lat = parseOptionalNumber(req.query.lat);
    const lng = parseOptionalNumber(req.query.lng);
    const radiusMiles = parseOptionalNumber(req.query.radiusMiles);
    const days = parseNumberList(req.query.days).filter((d) => d >= 0 && d <= 6);
    const startTime = normalizeTime(req.query.startTime);
    const endTime = normalizeTime(req.query.endTime);
    const offersOnly = req.query.offers === "true" || req.query.offers === "1";
    const menuType =
      req.query.menuType === "food_and_drinks" || req.query.menuType === "drinks_only"
        ? req.query.menuType
        : null;
    const carouselId =
      typeof req.query.carouselId === "string" ? req.query.carouselId.trim() : "";

    const params: unknown[] = [];
    const where: string[] = [`m.is_active = true`];

    const addParam = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    // Distance sort measures from the request's lat/lng, so it needs coordinates.
    if (sortBy === "distance" && (lat === null || lng === null)) {
      res.status(400).json({ error: "sortBy=distance requires lat and lng" });
      return;
    }
    const distanceSql =
      sortBy === "distance" && lat !== null && lng !== null
        ? distanceMilesSql(addParam(lat), addParam(lng))
        : null;
    if (distanceSql) {
      // Merchants without coordinates have no distance, so they are left out.
      where.push(`m.latitude IS NOT NULL AND m.longitude IS NOT NULL`);
    }
    const { selectExpr, orderBy } = sortExpressions(sortBy, distanceSql);

    if (search) {
      // Prefer GET /events for text search; merchant list still matches venue name,
      // categories, and any active event FTS vector.
      const searchParam = addParam(`%${search}%`);
      const ftsParam = addParam(search);
      where.push(`(
        m.restaurant_name ILIKE ${searchParam}
        OR EXISTS (
          SELECT 1 FROM events e
          WHERE e.merchant_id = m.id
            AND e.is_active = true
            AND e.search_vector @@ websearch_to_tsquery('english', ${ftsParam})
        )
        OR EXISTS (
          SELECT 1
          FROM merchant_categories mc
          JOIN categories c ON c.id = mc.category_id
          WHERE mc.merchant_id = m.id
            AND c.name ILIKE ${searchParam}
        )
      )`);
    }

    if (categoryIds.length > 0) {
      const catsParam = addParam(categoryIds);
      where.push(`EXISTS (
        SELECT 1 FROM merchant_categories mc
        WHERE mc.merchant_id = m.id
          AND mc.category_id = ANY(${catsParam}::uuid[])
      )`);
    }

    if (neighborhood) {
      where.push(`m.neighborhood ILIKE ${addParam(neighborhood)}`);
    }

    if (north !== null && south !== null && east !== null && west !== null) {
      where.push(`m.latitude IS NOT NULL AND m.longitude IS NOT NULL`);
      where.push(`m.latitude >= ${addParam(south)} AND m.latitude <= ${addParam(north)}`);
      where.push(`m.longitude >= ${addParam(west)} AND m.longitude <= ${addParam(east)}`);
    }

    if (lat !== null && lng !== null && radiusMiles !== null && radiusMiles > 0) {
      where.push(`m.latitude IS NOT NULL AND m.longitude IS NOT NULL`);
      const latParam = addParam(lat);
      const lngParam = addParam(lng);
      const radiusParam = addParam(radiusMiles);
      where.push(`(
        3959 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(${latParam})) * cos(radians(m.latitude))
            * cos(radians(m.longitude) - radians(${lngParam}))
            + sin(radians(${latParam})) * sin(radians(m.latitude))
          ))
        )
      ) <= ${radiusParam}`);
    }

    if (days.length > 0 || (startTime && endTime)) {
      // Prefer GET /events for schedule browsing; kept here for merchant list callers.
      const scheduleConditions: string[] = [
        `es.event_id = e.id`,
        `es.is_active = true`,
        `e.merchant_id = m.id`,
        `e.is_active = true`,
      ];
      if (days.length > 0) {
        const daysParam = addParam(days);
        scheduleConditions.push(`(
          (
            es.schedule_type = 'recurring'
            AND es.day_of_week = ANY(${daysParam}::smallint[])
          )
          OR (
            es.schedule_type = 'one_off'
            AND es.specific_date IS NOT NULL
            AND EXTRACT(DOW FROM es.specific_date)::int = ANY(${daysParam}::int[])
          )
        )`);
      }
      if (startTime && endTime) {
        const startParam = addParam(startTime);
        const endParam = addParam(endTime);
        scheduleConditions.push(`es.start_time < ${endParam}::time`);
        scheduleConditions.push(`es.end_time > ${startParam}::time`);
      }
      where.push(`EXISTS (
        SELECT 1
        FROM events e
        JOIN event_schedules es ON es.event_id = e.id
        WHERE ${scheduleConditions.join(" AND ")}
      )`);
    }

    if (offersOnly) {
      where.push(`EXISTS (
        SELECT 1 FROM merchant_offers o
        WHERE o.store_id = m.id
          AND o.is_active = true
          AND o.end_time > NOW()
      )`);
    }

    if (menuType) {
      if (menuType === "drinks_only") {
        where.push(`EXISTS (
          SELECT 1
          FROM events e
          JOIN event_menus em ON em.event_id = e.id
          JOIN menus mn ON mn.id = em.menu_id
          WHERE e.merchant_id = m.id
            AND e.is_active = true
            AND mn.is_active = true
            AND mn.menu_type IN ('drinks', 'drinks_only')
        )`);
      } else {
        where.push(`EXISTS (
          SELECT 1
          FROM events e
          JOIN event_menus em ON em.event_id = e.id
          JOIN menus mn ON mn.id = em.menu_id
          WHERE e.merchant_id = m.id
            AND e.is_active = true
            AND mn.is_active = true
            AND (
              mn.menu_type IS NULL
              OR mn.menu_type IN ('food', 'both', 'food_and_drinks', 'prix_fixe')
            )
        )`);
      }
    }

    if (carouselId) {
      const carouselParam = addParam(carouselId);
      where.push(`EXISTS (
        SELECT 1 FROM carousel_merchants cm
        WHERE cm.merchant_id = m.id
          AND cm.carousel_id = ${carouselParam}
          AND cm.is_active = true
      )`);
    }

    // Total for the whole search: the same filters with no cursor. Snapshot before the
    // cursor's own conditions and parameters are added.
    // Only the first page asks for the total; later pages keep the number the client already has.
    const countQuery = cursor
      ? null
      : compactParams(
          `SELECT COUNT(*)::int AS total FROM "Merchant" m WHERE ${where.join("\n          AND ")}`,
          [...params],
        );

    // Keyset seek: request sortBy already matched cursor.sort via safeguard.
    if (cursor) {
      const idParam = addParam(cursor.id);
      if (sortBy === "default") {
        if (typeof cursor.v !== "string") {
          res.status(400).json({ error: "invalid cursor" });
          return;
        }
        const nameParam = addParam(cursor.v);
        where.push(`(m.restaurant_name, m.id) > (${nameParam}, ${idParam})`);
      } else {
        if (typeof cursor.v !== "number") {
          res.status(400).json({ error: "invalid cursor" });
          return;
        }
        const valueParam = addParam(cursor.v);
        if (sortBy === "distance" && distanceSql) {
          // Ascending order: nearer rows come first, so the seek moves forward with ">".
          where.push(`(
            (${distanceSql}) > ${valueParam}
            OR (
              (${distanceSql}) = ${valueParam}
              AND m.id > ${idParam}
            )
          )`);
        } else {
          const metricExpr =
            sortBy === "highest_rated"
              ? EFFECTIVE_RATING_SQL
              : EFFECTIVE_REVIEW_COUNT_SQL;
          where.push(`(
            (${metricExpr}) < ${valueParam}
            OR (
              (${metricExpr}) = ${valueParam}
              AND m.id > ${idParam}
            )
          )`);
        }
      }
    }

    const limitParam = addParam(limit + 1);

    const sql = `
      WITH page AS (
        SELECT
          m.id,
          m.restaurant_name,
          m.street_address,
          m.city,
          m.state,
          m.zip_code,
          m.latitude,
          m.longitude,
          m.logo_url,
          m.neighborhood,
          m.slug,
          ${selectExpr}
        FROM "Merchant" m
        WHERE ${where.join("\n          AND ")}
        ORDER BY ${orderBy}
        LIMIT ${limitParam}
      )
      SELECT
        p.*,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', e.id,
            'event_type', e.event_type,
            'title', e.title,
            'display_order', e.display_order
          ) ORDER BY e.display_order, e.title)
          FROM events e
          WHERE e.merchant_id = p.id
            AND e.is_active = true
        ), '[]'::json) AS events,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', mc.id,
            'categories', json_build_object(
              'id', c.id,
              'name', c.name,
              'slug', c.slug,
              'parent_id', c.parent_id
            )
          ))
          FROM merchant_categories mc
          JOIN categories c ON c.id = mc.category_id
          WHERE mc.merchant_id = p.id
        ), '[]'::json) AS merchant_categories,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', o.id,
            'is_active', o.is_active,
            'end_time', o.end_time
          ))
          FROM merchant_offers o
          WHERE o.store_id = p.id
        ), '[]'::json) AS merchant_offers,
        COALESCE((
          SELECT json_agg(json_build_object(
            'google_rating', g.google_rating,
            'google_review_count', g.google_review_count,
            'google_rating_url', g.google_rating_url,
            'match_confidence', g.match_confidence
          ))
          FROM merchant_google_ratings g
          WHERE g.merchant_id = p.id
        ), '[]'::json) AS merchant_google_ratings
      FROM page p
      ORDER BY
        ${
          sortBy === "default"
            ? "p.restaurant_name ASC, p.id ASC"
            : sortBy === "distance"
              ? "p.sort_value ASC, p.id ASC"
              : "p.sort_value DESC, p.id ASC"
        }
    `;

    const [result, countResult] = await Promise.all([
      pool.query<MerchantListRow>(sql, params),
      countQuery ? pool.query<{ total: number }>(countQuery.sql, countQuery.params) : null,
    ]);
    const total = countResult ? (countResult.rows[0]?.total ?? 0) : null;
    const rows = result.rows;
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    const last = data[data.length - 1];
    const nextCursor = hasMore && last ? encodeCursor(sortBy, last) : null;

    res.status(200).json({
      data,
      pagination: {
        limit,
        sortBy,
        hasMore,
        nextCursor,
        total,
      },
    });
  } catch (error) {
    console.error("GET /merchants failed:", error);
    res.status(500).json({ error: "Failed to fetch merchants" });
  }
});

/** GET /merchants/:slugOrId — detail by slug or numeric id */
router.get("/:slugOrId", async (req: Request, res: Response) => {
  try {
    const raw = String(req.params.slugOrId ?? "").trim();
    if (!raw) {
      res.status(400).json({ error: "Missing merchant id or slug" });
      return;
    }

    const isNumericId = /^\d+$/.test(raw);
    const result = await pool.query(
      `
      SELECT
        m.id,
        m.restaurant_name,
        m.street_address,
        m.street_address_line_2,
        m.city,
        m.state,
        m.zip_code,
        m.latitude,
        m.longitude,
        m.logo_url,
        m.neighborhood,
        m.slug,
        m.phone_number,
        m.website,
        COALESCE((
          SELECT json_agg(event_row ORDER BY display_order, title)
          FROM (
            SELECT
              json_build_object(
                'id', e.id,
                'event_type', e.event_type,
                'title', e.title,
                'description', e.description,
                'image_url', e.image_url,
                'category_tags', e.category_tags,
                'is_verified', e.is_verified,
                'source_url', e.source_url,
                'source_label', e.source_label,
                'display_order', e.display_order,
                'event_schedules', COALESCE((
                  SELECT json_agg(json_build_object(
                    'id', es.id,
                    'schedule_type', es.schedule_type,
                    'day_of_week', es.day_of_week,
                    'start_time', es.start_time,
                    'end_time', es.end_time,
                    'specific_date', es.specific_date,
                    'recurrence_rule', es.recurrence_rule,
                    'valid_from', es.valid_from,
                    'valid_until', es.valid_until
                  ) ORDER BY
                    es.schedule_type,
                    es.day_of_week NULLS LAST,
                    es.specific_date NULLS LAST,
                    es.start_time)
                  FROM event_schedules es
                  WHERE es.event_id = e.id
                    AND es.is_active = true
                ), '[]'::json),
                'menus', COALESCE((
                  SELECT json_agg(json_build_object(
                    'id', mn.id,
                    'title', mn.title,
                    'menu_type', mn.menu_type,
                    'menu_text', mn.menu_text,
                    'source_url', mn.source_url,
                    'source_label', mn.source_label,
                    'display_order', em.display_order
                  ) ORDER BY em.display_order, mn.title)
                  FROM event_menus em
                  JOIN menus mn ON mn.id = em.menu_id
                  WHERE em.event_id = e.id
                    AND mn.is_active = true
                ), '[]'::json)
              ) AS event_row,
              e.display_order,
              e.title
            FROM events e
            WHERE e.merchant_id = m.id
              AND e.is_active = true
          ) events_q
        ), '[]'::json) AS events,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', mc.id,
            'categories', json_build_object(
              'id', c.id,
              'name', c.name,
              'slug', c.slug,
              'parent_id', c.parent_id
            )
          ))
          FROM merchant_categories mc
          JOIN categories c ON c.id = mc.category_id
          WHERE mc.merchant_id = m.id
        ), '[]'::json) AS merchant_categories,
        COALESCE((
          SELECT json_agg(json_build_object(
            'id', o.id,
            'is_active', o.is_active,
            'end_time', o.end_time
          ))
          FROM merchant_offers o
          WHERE o.store_id = m.id
        ), '[]'::json) AS merchant_offers,
        COALESCE((
          SELECT json_agg(json_build_object(
            'google_rating', g.google_rating,
            'google_review_count', g.google_review_count,
            'google_rating_url', g.google_rating_url,
            'match_confidence', g.match_confidence
          ))
          FROM merchant_google_ratings g
          WHERE g.merchant_id = m.id
        ), '[]'::json) AS merchant_google_ratings
      FROM "Merchant" m
      WHERE ${isNumericId ? "m.id = $1" : "m.slug = $1"}
      LIMIT 1
      `,
      [isNumericId ? Number(raw) : raw],
    );

    const merchant = result.rows[0];
    if (!merchant) {
      res.status(404).json({ error: "Merchant not found" });
      return;
    }

    res.status(200).json({ data: merchant });
  } catch (error) {
    console.error("GET /merchants/:slugOrId failed:", error);
    res.status(500).json({ error: "Failed to fetch merchant" });
  }
});

export default router;
