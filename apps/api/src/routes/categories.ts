import { Router, type Request, type Response } from "express";
import { pool } from "../db";

const router = Router();

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  category_type: string;
};

/**
 * GET /categories
 * Returns full category catalog plus IDs linked to at least one active merchant.
 */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const [categoriesResult, activeResult] = await Promise.all([
      pool.query<CategoryRow>(
        `
          SELECT id, name, slug, parent_id, description, category_type
          FROM categories
          ORDER BY name ASC
        `,
      ),
      pool.query<{ category_id: string }>(
        `
          SELECT DISTINCT mc.category_id
          FROM merchant_categories mc
          JOIN "Merchant" m ON m.id = mc.merchant_id
          WHERE m.is_active = true
        `,
      ),
    ]);

    res.status(200).json({
      data: categoriesResult.rows,
      activeIds: activeResult.rows.map((r) => r.category_id),
    });
  } catch (error) {
    console.error("GET /categories failed:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default router;
