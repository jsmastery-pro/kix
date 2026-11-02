// React twin of ProductCard.astro (plan 08) for listings rendered inside React islands, where Astro
// components can't render. Same markup and ui-product-card classes; keep the two in step. The
// listing look (square tile, name and price on one row) is the `listing` size.
import { ShoppingBag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { imgAttrs } from '../../wix/media';
import type { ProductSummary } from '../../wix/storefront/types';
import type { TileTone } from './tones';

interface Props {
  product: ProductSummary;
  tone: TileTone;
  className?: string;
}

export default function ProductCard({ product: p, tone, className = '' }: Props) {
  const href = `/products/${p.slug}`;
  // Price display follows the kit's ProductSummary contract: "From" first, then a range, else the price with an optional labelled "was".
  const price = p.fromPrice ? `From ${p.price}` : p.price !== p.maxPrice ? `${p.price} – ${p.maxPrice}` : p.price;
  const wasPrice = !p.fromPrice && p.price === p.maxPrice ? p.compareAtPrice : null;
  const availability = p.availability === 'OUT_OF_STOCK' ? (p.preorder ? 'Pre-order' : 'Sold out') : null;
  const image = imgAttrs(p.imageUrl, '(min-width: 1024px) 24vw, (min-width: 768px) 36vw, 46vw');
  const imageRef = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(false);
  // Like Photo.astro: an image that failed before hydration never fires onError, so check once mounted.
  useEffect(() => {
    const img = imageRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  const showImage = 'src' in image && !failed;

  return (
    <article className={['ui-product-card', 'ui-product-card--listing', className].filter(Boolean).join(' ')}>
      <div className="ui-product-card__media">
        <a href={href} className="ui-product-card__link" tabIndex={-1} aria-hidden="true">
          <span className={`ui-photo ui-product-card__image ui-tone--${tone}`}>
            {showImage && <img ref={imageRef} {...image} alt="" onError={() => setFailed(true)} />}
            <span className="ui-photo__fallback" hidden={showImage}>Image placeholder</span>
          </span>
        </a>
        {p.ribbons.length > 0 && (
          <span className="ui-product-card__ribbons">
            {p.ribbons.map((ribbon) => <span key={ribbon} className="ui-badge ui-badge--new">{ribbon}</span>)}
          </span>
        )}
        <a href={href} aria-label={`Choose options for ${p.name}`} title={`Choose options for ${p.name}`} className="ui-icon-button ui-icon-button--tile ui-icon-button--dark ui-product-card__bag">
          <ShoppingBag aria-hidden="true" />
        </a>
      </div>
      <div className="ui-product-card__body">
        <h3 className="ui-product-card__name"><a href={href}>{p.name}</a></h3>
        <p className="ui-product-card__price">
          <span>{price}</span>
          {wasPrice && <s className="ui-product-card__was"><span className="sr-only">Was </span>{wasPrice}</s>}
          {p.pricePerUnit && <span className="ui-product-card__unit">{p.pricePerUnit}</span>}
        </p>
        {p.discountNames.length > 0 && <p className="ui-product-card__note">{p.discountNames.join(' · ')}</p>}
        {availability && <p className="ui-product-card__note">{availability}</p>}
      </div>
    </article>
  );
}

/** A tile-shaped placeholder while the first page of products loads. */
export function ProductCardSkeleton() {
  return (
    <div className="ui-product-card ui-product-card--listing ui-product-card--skeleton" aria-hidden="true">
      <span className="ui-product-card__image" />
      <div className="ui-product-card__body">
        <span className="ui-skeleton-line" style={{ width: '70%' }} />
        <span className="ui-skeleton-line" style={{ width: '30%' }} />
      </div>
    </div>
  );
}
