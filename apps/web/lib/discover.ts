import {
  DEFAULT_FILTERS,
  resolveFiltersForApi,
  type MerchantFilters,
} from "@/lib/filters";
import type { EventSortBy, FetchEventsParams } from "@/lib/events";

/**
 * One carousel on the Discover page.
 *
 * Curate here: each row is an events query (sort, FTS search, schedule filter,
 * event type, or tags). Empty rows (e.g. "Happening now" late at night) hide.
 */
export type DiscoverSection = {
  id: string;
  title: string;
  description: string;
  sortBy: EventSortBy;
  /** Full-text search against events.search_vector. */
  search?: string;
  /** Filter by events.event_type values. */
  eventTypes?: string[];
  /** Filter by overlap with events.category_tags. */
  tags?: string[];
  /** Schedule and other filters, same as the search page. */
  filters?: Partial<MerchantFilters>;
  /** Where "View all" goes. */
  viewAllHref: string;
};

export const DISCOVER_SECTIONS: DiscoverSection[] = [
  {
    id: "happening-now",
    title: "Happening now",
    description: "Happy hours running right this minute",
    sortBy: "highest_rated",
    filters: { scheduleMode: "now" },
    viewAllHref: "/search?when=now",
  },
  {
    id: "top-rated",
    title: "Top rated",
    description: "The best-reviewed spots in the city",
    sortBy: "highest_rated",
    viewAllHref: "/search",
  },
  {
    id: "crowd-favorites",
    title: "Crowd favorites",
    description: "Places everyone is talking about",
    sortBy: "most_reviewed",
    viewAllHref: "/search",
  },
  {
    id: "cocktail-bars",
    title: "Cocktail bars",
    description: "Craft drinks at happy hour prices",
    sortBy: "highest_rated",
    search: "Cocktail Bar",
    viewAllHref: "/search?search=Cocktail+Bar",
  },
  {
    id: "brunch",
    title: "Brunch",
    description: "Start the day with a deal",
    sortBy: "highest_rated",
    search: "Brunch",
    viewAllHref: "/search?search=Brunch",
  },
];

/** Quick-start searches shown under the Discover heading. */
export const DISCOVER_TOPICS = [
  "Pizza",
  "Tacos",
  "Sushi",
  "Burgers",
  "Oysters",
  "Wings",
  "Wine Bar",
  "Rooftop",
];

export const DISCOVER_ROW_SIZE = 12;

export function discoverQuery(section: DiscoverSection): FetchEventsParams {
  return {
    limit: DISCOVER_ROW_SIZE,
    sortBy: section.sortBy,
    ...(section.search ? { search: section.search } : {}),
    ...(section.eventTypes?.length ? { eventTypes: section.eventTypes } : {}),
    ...(section.tags?.length ? { tags: section.tags } : {}),
    ...resolveFiltersForApi({ ...DEFAULT_FILTERS, ...section.filters }),
  };
}
