// The explore listing island (plan 08), mounted by /shop and /category/[slug]. All selection, URL
// sync, facets and paging live in the kit's shop store through useShop; this file only renders.
// The first render (server, then hydration) must match: until `ready`, controls read the URL state
// the page parsed on the server, and facets come from the server's read until the store has its own.
import { SlidersHorizontal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useShop } from '../../hooks/storefront/useShop';
import { track } from '../../scripts/analytics';
import type { Category, FacetData, ProductSummary } from '../../wix/storefront/types';
import CategoryNav from '../ui/CategoryNav';
import ColorDot from '../ui/ColorDot';
import ProductCard, { ProductCardSkeleton } from '../ui/ProductCard';
import RangeSlider from '../ui/RangeSlider';
import SearchField from '../ui/SearchField';
import type { TileTone } from '../ui/tones';

export interface ShopUrlView {
  search: string;
  minPrice: number | null;
  maxPrice: number | null;
  choiceIds: string[];
  hasFilters: boolean;
}

interface Props {
  initialProducts?: ProductSummary[];
  initialCategories: Category[];
  initialCategoryId: string | null;
  initialTotal: number | null;
  initialFacetData: FacetData;
  urlState: ShopUrlView;
  /** `slug` is the page's category slug, or 'all' on /shop; it is also the analytics `category`. */
  scope: { slug: string; label: { one: string; many: string } };
  categoryNav: { label: string; href: string; count: number | null; current: boolean }[];
}

type FilterName = 'category' | 'price' | 'color' | 'search' | 'clear';

const TONES: TileTone[] = ['beige', 'aqua', 'rose', 'mint', 'peach', 'periwinkle', 'lilac', 'coral'];
const SKELETONS = 6;
const dollars = (n: number) => `$${n}`;
const toNumber = (value: number | string | undefined | null): number | null => {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export default function ShopView({ initialProducts, initialCategories, initialCategoryId, initialTotal, initialFacetData, urlState, scope, categoryNav }: Props) {
  const shop = useShop({ initialProducts, initialCategories, initialCategoryId });
  const [ready, setReady] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const userChanged = useRef(false);
  const lastTotal = useRef(initialTotal);
  // useShop's effect (start: adopt the URL) runs before this one, so `ready` renders the store's selection.
  useEffect(() => setReady(true), []);
  useEffect(() => {
    if (shop.total !== null) lastTotal.current = shop.total;
  }, [shop.total]);

  // No count beside an error: the last one no longer describes what's on screen.
  const total = shop.error ? null : (shop.total ?? lastTotal.current);
  const facetsLoaded = shop.facets.length > 0 || shop.priceRange !== null;
  const facets = facetsLoaded ? shop.facets : initialFacetData.facets;
  const priceRange = facetsLoaded ? shop.priceRange : initialFacetData.priceRange;
  const colorFacets = facets.filter((f) => f.isColor && f.choices.length > 0);
  const search = ready ? (shop.filters.search ?? '') : urlState.search;
  const pressed = ready ? shop.selectedChoiceIds : urlState.choiceIds;
  const hasFilters = ready ? shop.hasActiveFilters : urlState.hasFilters;
  const busy = ready && shop.loading && userChanged.current;

  const bounds = priceRange ? { min: Math.floor(priceRange.min), max: Math.ceil(priceRange.max) } : null;
  const clamp = (n: number | null, fallback: number) => (n === null || !bounds ? fallback : Math.min(Math.max(n, bounds.min), bounds.max));
  const priceValue: [number, number] | null = bounds
    ? [
        clamp(ready ? toNumber(shop.filters.minPrice) : urlState.minPrice, bounds.min),
        clamp(ready ? toNumber(shop.filters.maxPrice) : urlState.maxPrice, bounds.max),
      ]
    : null;
  const priceActive = !!bounds && !!priceValue && (priceValue[0] > bounds.min || priceValue[1] < bounds.max);
  const activeCount = (priceActive ? 1 : 0) + pressed.length;

  const changed = (filter: FilterName) => {
    userChanged.current = true;
    track('catalog_filtered', { filter, category: scope.slug });
  };
  const commitPrice = ([lo, hi]: [number, number]) => {
    if (!bounds) return;
    changed('price');
    shop.setFilters({ ...shop.filters, minPrice: lo > bounds.min ? lo : undefined, maxPrice: hi < bounds.max ? hi : undefined });
  };
  const submitSearch = (text: string) => {
    if (text === (shop.filters.search ?? '')) return;
    changed('search');
    shop.setFilters({ ...shop.filters, search: text || undefined });
  };
  const toggleColor = (choiceId: string) => {
    changed('color');
    shop.toggleChoice(choiceId);
  };
  const clear = () => {
    changed('clear');
    shop.clearFilters();
  };
  const retry = () => {
    userChanged.current = true;
    shop.retry();
  };

  const products = shop.products;
  const showSkeletons = products === null || (products.length === 0 && busy);
  const label = total === 1 ? scope.label.one : scope.label.many;

  return (
    <div className="explore">
      <div className="explore__head">
        <h1 className="ui-page-title">{total !== null ? `${total} ${label}` : label}</h1>
        <SearchField id="explore-search" label="Search sneakers" placeholder="Search" value={search} onSubmit={submitSearch} className="explore__search" />
        <p className="sr-only" aria-live="polite">{ready && userChanged.current && shop.total !== null ? `${shop.total} ${label}` : ''}</p>
      </div>

      <aside className="explore__sidebar" aria-label="Categories and filters">
        <h2 className="ui-filter-heading explore__sidebar-heading">Sneakers</h2>
        <CategoryNav
          label="Sneaker categories"
          items={categoryNav}
          className="explore__categories"
          onNavigate={() => track('catalog_filtered', { filter: 'category', category: scope.slug }, { beacon: true })}
        />
        <button
          type="button"
          className="ui-button ui-button--secondary explore__filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls="explore-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal aria-hidden="true" />
          {activeCount > 0 ? `Filters (${activeCount})` : 'Filters'}
        </button>
        <div id="explore-filters" className="explore__filters" data-open={filtersOpen}>
          <h2 className="ui-filter-heading explore__filters-heading">Filter</h2>
          {bounds && priceValue && (
            <section className="explore__group" aria-labelledby="explore-price">
              <h3 id="explore-price" className="ui-filter-label">Price</h3>
              <RangeSlider
                className="explore__range"
                min={bounds.min} max={bounds.max} value={priceValue}
                onCommit={commitPrice} format={dollars}
                minLabel="Minimum price" maxLabel="Maximum price"
              />
            </section>
          )}
          {colorFacets.map((facet) => (
            <section key={facet.id} className="explore__group" aria-labelledby={`explore-facet-${facet.id}`}>
              <h3 id={`explore-facet-${facet.id}`} className="ui-filter-label">{facet.name}</h3>
              <div className="explore__colors">
                {facet.choices.map((choice) => (
                  <ColorDot
                    key={choice.id}
                    name={choice.name}
                    hex={choice.colorCode}
                    count={choice.count}
                    pressed={pressed.includes(choice.id)}
                    pending={!ready || shop.facets.length === 0}
                    onToggle={() => toggleColor(choice.id)}
                  />
                ))}
              </div>
            </section>
          ))}
          {hasFilters && (
            <button type="button" className="ui-button ui-button--quiet explore__clear" onClick={clear}>Clear filters</button>
          )}
        </div>
      </aside>

      <section className="explore__results" aria-labelledby="explore-results">
        <h2 id="explore-results" className="sr-only">Results</h2>
        {shop.error ? (
          <div className="ui-empty" role="alert">
            <p className="ui-empty__title">We couldn't load sneakers.</p>
            <p className="ui-empty__text">Check your connection and try again.</p>
            <div className="ui-empty__actions">
              <button type="button" className="ui-button ui-button--primary" onClick={retry}>Try again</button>
              {hasFilters && <button type="button" className="ui-button ui-button--secondary" onClick={clear}>Clear filters</button>}
            </div>
          </div>
        ) : showSkeletons ? (
          <div className="explore__grid" aria-busy="true">
            {Array.from({ length: SKELETONS }, (_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : products.length === 0 ? (
          hasFilters ? (
            <div className="ui-empty">
              <p className="ui-empty__title">No sneakers match these filters.</p>
              <p className="ui-empty__text">Try another search, a wider price range or fewer colors.</p>
              <div className="ui-empty__actions">
                <button type="button" className="ui-button ui-button--primary" onClick={clear}>Clear filters</button>
              </div>
            </div>
          ) : (
            <div className="ui-empty">
              <p className="ui-empty__title">No sneakers here yet.</p>
              {scope.slug !== 'all' && (
                <div className="ui-empty__actions">
                  <a className="ui-button ui-button--secondary" href="/shop">See all sneakers</a>
                </div>
              )}
            </div>
          )
        ) : (
          <>
            <div className="explore__grid ui-busy" aria-busy={busy}>
              {products.map((product, index) => <ProductCard key={product.id} product={product} tone={TONES[index % TONES.length]} />)}
            </div>
            {shop.hasMore && (
              <div className="explore__more">
                <button type="button" className="ui-button ui-button--secondary" disabled={shop.loadingMore} onClick={() => shop.loadMore()}>
                  {shop.loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
