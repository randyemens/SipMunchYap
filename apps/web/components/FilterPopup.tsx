"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchCategories,
  getCategoryDimensions,
  getSubCategories,
  type Category,
  type CategoryType,
} from "@/lib/categories";
import {
  DEFAULT_FILTERS,
  type MerchantFilters,
  type MenuType,
} from "@/lib/filters";

/** Same paths as lucide-react ChevronRight / ChevronDown (size 12). */
function ChevronRightIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-foreground/50"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ChevronDownIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-foreground/50"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function OptionChip({
  selected,
  onClick,
  children,
  variant = "default",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  variant?: "default" | "outline";
}) {
  const className =
    variant === "outline"
      ? selected
        ? "border-accent bg-accent/15 font-semibold text-accent-text hover:bg-accent/25"
        : "border-accent bg-accent/10 text-accent-text hover:bg-accent/20"
      : selected
        ? "border-transparent bg-sunset text-on-accent"
        : "border-line-strong bg-surface-raised text-foreground/80 hover:border-accent-light hover:bg-accent/10";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-fit rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${className}`}
    >
      {children}
    </button>
  );
}

type FilterPopupProps = {
  open: boolean;
  initialFilters: MerchantFilters;
  onClose: () => void;
  onApply: (filters: MerchantFilters) => void;
};

export function FilterPopup({
  open,
  initialFilters,
  onClose,
  onApply,
}: FilterPopupProps) {
  const [draft, setDraft] = useState<MerchantFilters>(initialFilters);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set());
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<CategoryType[]>([
    "venue_type",
  ]);

  useEffect(() => {
    if (!open) return;
    setDraft(initialFilters);
  }, [open, initialFilters]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingCategories(true);
    setCategoriesError(null);
    void fetchCategories()
      .then((res) => {
        if (cancelled) return;
        setCategories(res.data);
        setActiveIds(new Set(res.activeIds));
      })
      .catch((err) => {
        if (cancelled) return;
        setCategoriesError(
          err instanceof Error ? err.message : "Failed to load categories",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingCategories(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const dimensions = useMemo(
    () => getCategoryDimensions(categories),
    [categories],
  );

  if (!open) return null;

  const toggleCategory = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((c) => c !== id)
        : [...prev.categoryIds, id],
    }));
  };

  const selectAllIds = (ids: string[], selected: boolean) => {
    setDraft((prev) => {
      if (selected) {
        return {
          ...prev,
          categoryIds: [...new Set([...prev.categoryIds, ...ids])],
        };
      }
      const drop = new Set(ids);
      return {
        ...prev,
        categoryIds: prev.categoryIds.filter((id) => !drop.has(id)),
      };
    });
  };

  const toggleSection = (type: CategoryType) => {
    setExpandedSections((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-scrim p-4 pt-[10vh]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close filters"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-popup-title"
        className="relative z-10 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-line bg-surface shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 id="filter-popup-title" className="text-lg font-semibold">
            Filters
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-2 py-1 text-sm text-foreground/70 hover:bg-tint-strong"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {/* Menu type */}
          <div>
            <h3 className="mb-3 text-sm font-semibold">Menu type</h3>
            <div className="flex flex-wrap gap-3 text-sm">
              {(
                [
                  ["all", "All"],
                  ["food_and_drinks", "Food & Drinks"],
                  ["drinks_only", "Drinks Only"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="menuType"
                    checked={draft.menuType === value}
                    onChange={() =>
                      setDraft((prev) => ({
                        ...prev,
                        menuType: value as MenuType,
                      }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Categories</h3>
            {loadingCategories && (
              <p className="text-sm text-foreground/60">Loading categories…</p>
            )}
            {categoriesError && (
              <p className="text-sm text-danger">{categoriesError}</p>
            )}
            {!loadingCategories &&
              !categoriesError &&
              dimensions.map((dim) => {
                if (dim.parents.length === 0) return null;

                const sections = dim.parents
                  .map((parent) => {
                    const subs = getSubCategories(categories, parent.id).filter(
                      (s) => activeIds.has(s.id),
                    );
                    const parentHasMerchants = activeIds.has(parent.id);
                    if (!parentHasMerchants && subs.length === 0) return null;
                    return { parent, subs, parentHasMerchants };
                  })
                  .filter(Boolean) as {
                  parent: Category;
                  subs: Category[];
                  parentHasMerchants: boolean;
                }[];

                if (sections.length === 0) return null;

                const isExpanded = expandedSections.includes(dim.type);
                const selectedInDim = sections.reduce((count, section) => {
                  const ids = [
                    ...(section.parentHasMerchants ? [section.parent.id] : []),
                    ...section.subs.map((s) => s.id),
                  ];
                  return (
                    count +
                    ids.filter((id) => draft.categoryIds.includes(id)).length
                  );
                }, 0);

                return (
                  <div
                    key={dim.type}
                    className="overflow-hidden rounded-lg border border-line"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(dim.type)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left hover:bg-tint-strong"
                      aria-expanded={isExpanded}
                    >
                      <span className="text-sm font-medium">
                        {dim.label}
                        {selectedInDim > 0 && (
                          <span className="ml-2 text-xs font-normal text-foreground/55">
                            ({selectedInDim})
                          </span>
                        )}
                      </span>
                      {isExpanded ? (
                        <ChevronDownIcon size={12} />
                      ) : (
                        <ChevronRightIcon size={12} />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="space-y-5 px-3 pb-3 pt-3">
                        {sections.map(
                          ({ parent, subs, parentHasMerchants }) => {
                            // Standalone parents (e.g. Cafe) need a subheader so they
                            // don't look attached to the previous group (e.g. Bar).
                            if (subs.length === 0) {
                              return (
                                <div key={parent.id}>
                                  <p className="mb-2 text-xs font-semibold text-foreground/80">
                                    {parent.name}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    <OptionChip
                                      selected={draft.categoryIds.includes(
                                        parent.id,
                                      )}
                                      onClick={() => toggleCategory(parent.id)}
                                    >
                                      {parent.name}
                                    </OptionChip>
                                  </div>
                                </div>
                              );
                            }

                            const selectableIds = [
                              ...(parentHasMerchants ? [parent.id] : []),
                              ...subs.map((s) => s.id),
                            ];
                            const allSelected = selectableIds.every((id) =>
                              draft.categoryIds.includes(id),
                            );
                            // Only show group labels when a dimension has multiple
                            // parent groups (e.g. Bar / Restaurant under Venue Type).
                            const showGroupHeading = sections.length > 1;

                            return (
                              <div key={parent.id}>
                                {showGroupHeading && (
                                  <p className="mb-2 text-xs font-semibold text-foreground/80">
                                    {parent.name}
                                  </p>
                                )}
                                <div className="flex flex-wrap gap-2">
                                  <OptionChip
                                    variant="outline"
                                    selected={allSelected}
                                    onClick={() =>
                                      selectAllIds(selectableIds, !allSelected)
                                    }
                                  >
                                    Select all
                                  </OptionChip>
                                  {subs.map((sub) => (
                                    <OptionChip
                                      key={sub.id}
                                      selected={draft.categoryIds.includes(
                                        sub.id,
                                      )}
                                      onClick={() => toggleCategory(sub.id)}
                                    >
                                      {sub.name}
                                    </OptionChip>
                                  ))}
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <button
            type="button"
            className="text-sm text-foreground/70 hover:text-foreground"
            onClick={() => setDraft(DEFAULT_FILTERS)}
          >
            Clear all
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-line-strong px-4 py-2 text-sm font-medium hover:bg-tint-strong"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onApply(draft)}
              className="rounded-xl bg-sunset sunset-hover px-4 py-2 text-sm font-medium text-on-accent"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
