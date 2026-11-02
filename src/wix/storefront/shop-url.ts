// Kix addition (plan 08), not shipped by the kit: reads the shop store's URL selection on the
// server, so a shared filtered link is rendered filtered before the island starts. It mirrors
// readUrlState() and decodeChoice() in shop-store.ts (neither is exported); keep the two in step.
// Picks group per `${kind}:${facetId}` exactly as the store's facetSelections() does. Linked child
// choices are not expanded here (the store adds them once facets load); Kix colors have none.
// Type-only imports, so it runs anywhere with no Wix SDK.
import type { FacetSelection } from "./catalog-core";
import type { ShopFilters } from "./shop-store";

export interface ShopUrlState extends ShopFilters {
  facetSelections: FacetSelection[];
  /** Every picked choice id, in URL order — what the island marks pressed before the store starts. */
  choiceIds: string[];
}

function decodeChoice(token: string): { kind: FacetSelection["kind"]; facetId: string; choiceId: string } | null {
  const parts = token.split(":");
  if (parts.length === 3 && (parts[0] === "option" || parts[0] === "modifier") && parts[2]) return { kind: parts[0], facetId: parts[1], choiceId: parts[2] };
  if (parts.length === 1 && parts[0]) return { kind: "option", facetId: "", choiceId: parts[0] };
  return null;
}

const SEARCH_MAX = 100; // the kit's search limit (catalog-core searchQuery)

/**
 * The URL without keys the explore page can't honour, or null when it is already clean. Bad price
 * bounds and over-long searches would make the catalog query throw (an error that no retry fixes);
 * `sort` and `category` have no control on the page, and the store's live `category` switch would
 * widen /shop past its Sports scope. Redirecting to the cleaned URL fixes server and client alike.
 */
export function cleanShopUrl(url: URL): URL | null {
  const next = new URL(url);
  const p = next.searchParams;
  const bound = (key: string) => {
    const raw = p.get(key);
    if (raw === null) return null;
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n) || n < 0) {
      p.delete(key);
      return null;
    }
    return n;
  };
  const min = bound("min");
  const max = bound("max");
  if (min !== null && max !== null && min > max) {
    p.delete("min");
    p.delete("max");
  }
  if ((p.get("q") ?? "").trim().length > SEARCH_MAX) p.delete("q");
  p.delete("sort");
  p.delete("category");
  return next.search === url.search ? null : next;
}

export function parseShopUrl(params: URLSearchParams): ShopUrlState {
  const state: ShopUrlState = { facetSelections: [], choiceIds: [] };
  if (params.get("min")) state.minPrice = params.get("min")!;
  if (params.get("max")) state.maxPrice = params.get("max")!;
  if (params.get("stock") === "1") state.inStockOnly = true;
  if (params.get("q")) state.search = params.get("q")!;

  const groups = new Map<string, FacetSelection>();
  for (const pick of params.getAll("choice").map(decodeChoice)) {
    if (!pick) continue;
    const key = `${pick.kind}:${pick.facetId}`;
    const group = groups.get(key) ?? { id: pick.facetId, kind: pick.kind, choiceIds: [] };
    if (!group.choiceIds.includes(pick.choiceId)) group.choiceIds.push(pick.choiceId);
    groups.set(key, group);
    if (!state.choiceIds.includes(pick.choiceId)) state.choiceIds.push(pick.choiceId);
  }
  state.facetSelections = [...groups.values()]
    .map((g) => ({ ...g, choiceIds: [...g.choiceIds].sort() }))
    .sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
  return state;
}
