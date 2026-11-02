// Server helpers shared by /shop and /category/[slug] (plan 08): the sidebar's sport links, the
// headline label per scope, and the parsed URL in the shape ShopView renders before it hydrates.
import type { ShopUrlState } from '../../wix/storefront/shop-url';
import type { Category } from '../../wix/storefront/types';
import type { ShopUrlView } from './ShopView';

const POSSESSIVE: Record<string, string> = { men: "Men's", women: "Women's", kids: "Kids'" };

/** "All", then Sports' children in the merchant's order, each with Wix's direct product count. */
export function sneakerNav(categories: Category[], sportsId: string | null, currentId: string | null) {
  const sports = categories
    .filter((c) => sportsId !== null && c.parentId === sportsId)
    .sort((a, b) => a.index - b.index || a.name.localeCompare(b.name));
  return [
    { label: 'All', href: '/shop', count: null, current: currentId === null || currentId === sportsId },
    ...sports.map((c) => ({ label: c.name, href: `/category/${c.slug}`, count: c.productCount, current: c.id === currentId })),
  ];
}

/** The headline's words after the count: "Lifestyle Sneakers", "Men's Sneakers", "New Arrivals". */
export function scopeLabel(category: Category | null, sportsId: string | null): { one: string; many: string } {
  const sneakers = (prefix = '') => ({ one: `${prefix}Sneaker`, many: `${prefix}Sneakers` });
  if (!category || category.id === sportsId) return sneakers();
  if (sportsId !== null && category.parentId === sportsId) return sneakers(`${category.name} `);
  if (POSSESSIVE[category.slug]) return sneakers(`${POSSESSIVE[category.slug]} `);
  if (category.slug === 'new-arrivals') return { one: 'New Arrival', many: 'New Arrivals' };
  if (category.slug === 'popular') return sneakers('Popular ');
  return { one: category.name, many: category.name };
}

/** The URL selection as ShopView shows it until the store has started; mirrors the store's hasActiveFilters. */
export function urlView(state: ShopUrlState): ShopUrlView {
  const num = (value: number | string | undefined) => {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const search = state.search?.trim() ?? '';
  return {
    search: state.search ?? '',
    minPrice: num(state.minPrice),
    maxPrice: num(state.maxPrice),
    choiceIds: state.choiceIds,
    hasFilters: state.choiceIds.length > 0 || !!state.inStockOnly || state.minPrice != null || state.maxPrice != null || search !== '',
  };
}
