export type CategoryType =
  | "venue_type"
  | "cuisine"
  | "dietary"
  | "experience"
  | "beverage";

export type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  category_type: CategoryType;
};

export type CategoriesResponse = {
  data: Category[];
  activeIds: string[];
};

export const CATEGORY_DIMENSIONS: { type: CategoryType; label: string }[] = [
  { type: "venue_type", label: "Venue Type" },
  { type: "cuisine", label: "Cuisine" },
  { type: "experience", label: "Experience" },
  { type: "dietary", label: "Dietary" },
  { type: "beverage", label: "Beverage" },
];

function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
}

export async function fetchCategories(): Promise<CategoriesResponse> {
  const res = await fetch(`${getApiBase()}/categories`);
  if (!res.ok) {
    throw new Error(`Failed to fetch categories (${res.status})`);
  }
  return res.json() as Promise<CategoriesResponse>;
}

export type CategoryDimension = {
  type: CategoryType;
  label: string;
  parents: Category[];
};

export function getCategoryDimensions(
  categories: Category[],
): CategoryDimension[] {
  return CATEGORY_DIMENSIONS.map((dim) => ({
    type: dim.type,
    label: dim.label,
    parents: categories.filter(
      (c) => c.parent_id === null && c.category_type === dim.type,
    ),
  }));
}

export function getSubCategories(
  categories: Category[],
  parentId: string,
): Category[] {
  return categories.filter((c) => c.parent_id === parentId);
}
