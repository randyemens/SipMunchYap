import { Router, type Request, type Response } from "express";
import { pool } from "../db";

const router = Router();

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

const SORT_OPTIONS = [
  "default",
  "highest_rated",
  "most_reviewed",
  "distance",
  "relevance",
] as const;
type SortBy = (typeof SORT_OPTIONS)[number];

/** Opaque cursor: sort tag + primary sort value + event id (uuid) tie-breaker. */
type EventCursor = { sort: SortBy; v: string | number; id: string };

type ParseCursorResult =
  | { status: "none" }
  | { status: "ok"; cursor: EventCursor }
  | { status: "invalid" }
  | { status: "sort_mismatch"; cursorSort: string };

type EventListRow = {
  id: string;
  merchant_id: number;
  event_type: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category_tags: string[] | null;
  is_verified: boolean;
  source_url: string | null;
  source_label: string | null;
  display_order: number;
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
  event_schedules: unknown;
  menus: unknown;
  merchant_categories: unknown;
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

function parseCursor(raw: unknown, sortBy: SortBy): ParseCursorResult {
  if (typeof raw !== "string" || !raw.trim()) return { status: "none" };
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    const v = parsed.v ?? parsed.name ?? parsed.value;
    const id = typeof parsed.id === "string" ? parsed.id : null;
    if (
      (typeof v !== "string" && typeof v !== "number") ||
      !id
    ) {
      return { status: "invalid" };
    }

    const cursorSort =
      typeof parsed.sort === "string"
        ? parsed.sort
        : typeof parsed.s === "string"
          ? parsed.s
          : null;

    if (!cursorSort) return { status: "invalid" };
    if (cursorSort !== sortBy) {
      return { status: "sort_mismatch", cursorSort };
    }
    if (!(SORT_OPTIONS as readonly string[]).includes(cursorSort)) {
      return { status: "invalid" };
    }

    return {
      status: "ok",
      cursor: { sort: cursorSort as SortBy, v, id },
    };
  } catch {
    return { status: "invalid" };
  }
}

function encodeCursor(sortBy: SortBy, row: EventListRow): string {
  return Buffer.from(
    JSON.stringify({
      sort: sortBy,
      v: row.sort_value ?? row.title,
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

function distanceMilesSql(latParam: string, lngParam: string): string {
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

function sortExpressions(
  sortBy: SortBy,
  distanceSql: string | null,
  rankSql: string | null,
): { selectExpr: string; orderBy: string } {
  if (sortBy === "relevance" && rankSql) {
    return {
      selectExpr: `${rankSql} AS sort_value`,
      orderBy: "sort_value DESC, e.id ASC",
    };
  }
  if (sortBy === "distance" && distanceSql) {
    return {
      selectExpr: `${distanceSql} AS sort_value`,
      orderBy: "sort_value ASC, e.id ASC",
    };
  }
  if (sortBy === "highest_rated") {
    return {
      selectExpr: `(${EFFECTIVE_RATING_SQL}) AS sort_value`,
      orderBy: "sort_value DESC, e.id ASC",
    };
  }
  if (sortBy === "most_reviewed") {
    return {
      selectExpr: `(${EFFECTIVE_REVIEW_COUNT_SQL}) AS sort_value`,
      orderBy: "sort_value DESC, e.id ASC",
    };
  }
  return {
    selectExpr: "e.title AS sort_value",
    orderBy: "e.display_order ASC, e.title ASC, e.id ASC",
  };
}

/**
 * Keep only the $n parameters a SQL string uses and renumber them from $1.
 * Postgres rejects parameters that are passed but never referenced.
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

/**
 * GET /events
 *
 * Query params:
 * - limit, cursor, sortBy=default|highest_rated|most_reviewed|distance|relevance
 * - search (websearch_to_tsquery against events.search_vector)
 * - eventTypes, tags (category_tags overlap)
 * - categoryIds (merchant venue categories)
 * - neighborhood
 * - north,south,east,west / lat,lng,radiusMiles
 * - days (0=Sun…6=Sat), startTime, endTime
 * - menuType=food_and_drinks|drinks_only
 * - offers
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const limit = parseLimit(req.query.limit);
    let sortBy = parseSortBy(req.query.sortBy);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    // Text without an explicit sort defaults to FTS relevance.
    if (search && sortBy === "default") sortBy = "relevance";
    if (sortBy === "relevance" && !search) sortBy = "default";

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
    const cursor = cursorResult.status === "ok" ? cursorResult.cursor : null;

    const eventTypes = parseCsv(req.query.eventTypes ?? req.query.eventType);
    const tags = parseCsv(req.query.tags);
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
    // New schema: 0=Sunday … 6=Saturday (Postgres DOW).
    const days = parseNumberList(req.query.days).filter((d) => d >= 0 && d <= 6);
    const startTime = normalizeTime(req.query.startTime);
    const endTime = normalizeTime(req.query.endTime);
    const offersOnly = req.query.offers === "true" || req.query.offers === "1";
    const menuType =
      req.query.menuType === "food_and_drinks" || req.query.menuType === "drinks_only"
        ? req.query.menuType
        : null;

    const params: unknown[] = [];
    const where: string[] = [`e.is_active = true`, `m.is_active = true`];

    const addParam = (value: unknown): string => {
      params.push(value);
      return `$${params.length}`;
    };

    // Hide events with nothing left to attend: recurring still in season, or
    // one-off on/after today. Past one-offs stay out of Discover/Search.
    where.push(`EXISTS (
      SELECT 1 FROM event_schedules es
      WHERE es.event_id = e.id
        AND es.is_active = true
        AND (es.valid_from IS NULL OR es.valid_from <= CURRENT_DATE)
        AND (es.valid_until IS NULL OR es.valid_until >= CURRENT_DATE)
        AND (
          es.schedule_type = 'recurring'
          OR (
            es.schedule_type = 'one_off'
            AND es.specific_date IS NOT NULL
            AND es.specific_date >= CURRENT_DATE
          )
        )
    )`);

    let rankSql: string | null = null;
    if (search) {
      const queryParam = addParam(search);
      // websearch_to_tsquery understands quoted phrases and OR/NOT like a search box.
      rankSql = `ts_rank(e.search_vector, websearch_to_tsquery('english', ${queryParam}))`;
      where.push(`e.search_vector @@ websearch_to_tsquery('english', ${queryParam})`);
    }

    if (eventTypes.length > 0) {
      where.push(`e.event_type = ANY(${addParam(eventTypes)}::text[])`);
    }

    if (tags.length > 0) {
      // Any overlap between requested tags and event.category_tags.
      where.push(`e.category_tags && ${addParam(tags)}::text[]`);
    }

    if (categoryIds.length > 0) {
      where.push(`EXISTS (
        SELECT 1 FROM merchant_categories mc
        WHERE mc.merchant_id = m.id
          AND mc.category_id = ANY(${addParam(categoryIds)}::uuid[])
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
      const scheduleConditions: string[] = [
        `es.event_id = e.id`,
        `es.is_active = true`,
        `(es.valid_from IS NULL OR es.valid_from <= CURRENT_DATE)`,
        `(es.valid_until IS NULL OR es.valid_until >= CURRENT_DATE)`,
      ];

      if (days.length > 0) {
        const daysParam = addParam(days);
        // One-offs: future/today only. If the date's weekday is "today", require
        // the calendar date to be today so next week's same weekday doesn't
        // match Now/Today filters.
        scheduleConditions.push(`(
          (
            es.schedule_type = 'recurring'
            AND es.day_of_week = ANY(${daysParam}::smallint[])
          )
          OR (
            es.schedule_type = 'one_off'
            AND es.specific_date IS NOT NULL
            AND es.specific_date >= CURRENT_DATE
            AND EXTRACT(DOW FROM es.specific_date)::int = ANY(${daysParam}::int[])
            AND (
              EXTRACT(DOW FROM es.specific_date)::int
                IS DISTINCT FROM EXTRACT(DOW FROM CURRENT_DATE)::int
              OR es.specific_date = CURRENT_DATE
            )
          )
        )`);
      }

      if (startTime && endTime) {
        const startParam = addParam(startTime);
        const endParam = addParam(endTime);
        // Same overlap rule the merchants list used: window intersects [start, end).
        scheduleConditions.push(`es.start_time < ${endParam}::time`);
        scheduleConditions.push(`es.end_time > ${startParam}::time`);
      }

      where.push(`EXISTS (
        SELECT 1 FROM event_schedules es
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
          SELECT 1 FROM event_menus em
          JOIN menus mn ON mn.id = em.menu_id
          WHERE em.event_id = e.id
            AND mn.is_active = true
            AND mn.menu_type IN ('drinks', 'drinks_only')
        )`);
      } else {
        where.push(`EXISTS (
          SELECT 1 FROM event_menus em
          JOIN menus mn ON mn.id = em.menu_id
          WHERE em.event_id = e.id
            AND mn.is_active = true
            AND (
              mn.menu_type IS NULL
              OR mn.menu_type IN ('food', 'both', 'food_and_drinks', 'prix_fixe')
            )
        )`);
      }
    }

    const distanceSql =
      sortBy === "distance" && lat !== null && lng !== null
        ? distanceMilesSql(addParam(lat), addParam(lng))
        : null;
    if (distanceSql) {
      where.push(`m.latitude IS NOT NULL AND m.longitude IS NOT NULL`);
    }

    const { selectExpr, orderBy } = sortExpressions(sortBy, distanceSql, rankSql);

    const countQuery = cursor
      ? null
      : compactParams(
          `SELECT COUNT(*)::int AS total
           FROM events e
           JOIN "Merchant" m ON m.id = e.merchant_id
           WHERE ${where.join("\n          AND ")}`,
          [...params],
        );

    if (cursor) {
      const idParam = addParam(cursor.id);
      if (sortBy === "default") {
        if (typeof cursor.v !== "string") {
          res.status(400).json({ error: "invalid cursor" });
          return;
        }
        const titleParam = addParam(cursor.v);
        where.push(`(e.title, e.id) > (${titleParam}, ${idParam}::uuid)`);
      } else {
        if (typeof cursor.v !== "number") {
          res.status(400).json({ error: "invalid cursor" });
          return;
        }
        const valueParam = addParam(cursor.v);
        if (sortBy === "distance" && distanceSql) {
          where.push(`(
            (${distanceSql}) > ${valueParam}
            OR (
              (${distanceSql}) = ${valueParam}
              AND e.id > ${idParam}::uuid
            )
          )`);
        } else if (sortBy === "relevance" && rankSql) {
          where.push(`(
            (${rankSql}) < ${valueParam}
            OR (
              (${rankSql}) = ${valueParam}
              AND e.id > ${idParam}::uuid
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
              AND e.id > ${idParam}::uuid
            )
          )`);
        }
      }
    }

    const limitParam = addParam(limit + 1);

    const sql = `
      WITH page AS (
        SELECT
          e.id,
          e.merchant_id,
          e.event_type,
          e.title,
          e.description,
          e.image_url,
          e.category_tags,
          e.is_verified,
          e.source_url,
          e.source_label,
          e.display_order,
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
        FROM events e
        JOIN "Merchant" m ON m.id = e.merchant_id
        WHERE ${where.join("\n          AND ")}
        ORDER BY ${orderBy}
        LIMIT ${limitParam}
      )
      SELECT
        p.*,
        COALESCE((
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
          WHERE es.event_id = p.id
            AND es.is_active = true
        ), '[]'::json) AS event_schedules,
        COALESCE((
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
          WHERE em.event_id = p.id
            AND mn.is_active = true
        ), '[]'::json) AS menus,
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
          WHERE mc.merchant_id = p.merchant_id
        ), '[]'::json) AS merchant_categories,
        COALESCE((
          SELECT json_agg(json_build_object(
            'google_rating', g.google_rating,
            'google_review_count', g.google_review_count,
            'google_rating_url', g.google_rating_url,
            'match_confidence', g.match_confidence
          ))
          FROM merchant_google_ratings g
          WHERE g.merchant_id = p.merchant_id
        ), '[]'::json) AS merchant_google_ratings
      FROM page p
      ORDER BY
        ${
          sortBy === "default"
            ? "p.display_order ASC, p.title ASC, p.id ASC"
            : sortBy === "distance"
              ? "p.sort_value ASC, p.id ASC"
              : "p.sort_value DESC, p.id ASC"
        }
    `;

    const [result, countResult] = await Promise.all([
      pool.query<EventListRow>(sql, params),
      countQuery
        ? pool.query<{ total: number }>(countQuery.sql, countQuery.params)
        : null,
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
    console.error("GET /events failed:", error);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

export default router;
