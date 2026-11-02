// The product page's island (plan 09): gallery and buy column on the kit's useProductDetail, which
// owns selection, variant resolution, availability and the add. Our pickers, not the kit's
// OptionPicker, which doesn't match the design. Add to Cart keeps the design's black: while the hook
// can't add, it is aria-disabled, the kit's reason shows under it, and a press moves focus to the
// first option with no pick. The add confirms inline; the header bag shows the new count.
import { Heart, LoaderCircle, ShoppingBag } from 'lucide-react';
import { useRef, useState } from 'react';
import { useProductDetail } from '../../hooks/storefront/useProductDetail';
import { captureError, track } from '../../scripts/analytics';
import type { ProductDetail } from '../../wix/storefront/types';
import OptionGroup from '../ui/OptionGroup';
import ProductGallery from '../ui/ProductGallery';

interface Props {
  initial: ProductDetail;
  /** "Men's Shoe"; null hides it. */
  eyebrow: string | null;
  /** The description's first paragraph (merchant HTML). */
  summaryHtml: string | null;
}

type Outcome = { tone: 'done' | 'error'; text: string } | null;

export default function ProductView({ initial, eyebrow, summaryHtml }: Props) {
  const d = useProductDetail({ initial });
  const [outcome, setOutcome] = useState<Outcome>(null);
  // Counts color picks, so picking the current color again brings its photo back.
  const [colorPicks, setColorPicks] = useState(0);
  const buyRef = useRef<HTMLDivElement>(null);
  const product = d.product ?? initial;
  const blocked = !d.canAdd || d.adding;

  const select = (optionId: string, choiceId: string) => {
    setOutcome(null);
    if (d.optionGroups.find((g) => g.id === optionId)?.isColor) setColorPicks((n) => n + 1);
    d.selectOption(optionId, choiceId);
  };

  async function addToCart() {
    if (d.adding) return;
    if (!d.canAdd) {
      const missing = d.optionGroups.find((g) => !g.choices.some((c) => c.selected));
      const target = missing && buyRef.current?.querySelector<HTMLButtonElement>(`[data-option-group="${missing.id}"] button:not(:disabled)`);
      if (target) {
        target.scrollIntoView({ block: 'center' });
        target.focus({ preventScroll: true });
      }
      return;
    }
    setOutcome(null);
    try {
      await d.add();
      track('product_added_to_cart', { product_id: product.id });
      setOutcome({ tone: 'done', text: 'Added to your bag.' });
    } catch (error) {
      captureError(error, 'cart_add');
      setOutcome({ tone: 'error', text: "We couldn't add this to your bag. Try again." });
    }
  }

  const lowStock = d.remaining !== null && d.remaining > 0 && d.remaining <= 10 && !d.isPreorder ? `Only ${d.remaining} left` : null;
  const guidance = !d.canAdd ? d.blockedReason : d.isPreorder ? d.preorderMessage : lowStock;
  const statusText = outcome?.text ?? guidance ?? '';
  const statusTone = outcome ? ` ui-status-line--${outcome.tone}` : '';

  return (
    <div className="pdp__top">
      <ProductGallery name={product.name} gallery={product.gallery} selectedImage={d.imageUrl} selectionKey={colorPicks} />

      <div ref={buyRef} className="pdp__buy">
        {eyebrow && <p className="ui-pdp-eyebrow">{eyebrow}</p>}
        <h1 className="ui-pdp-title pdp__title">{product.name}</h1>
        <div className="ui-price pdp__price">
          <span className="ui-price__now">{d.price}</span>
          {d.compareAtPrice && <s className="ui-price__was"><span className="sr-only">Was </span>{d.compareAtPrice}</s>}
          {d.pricePerUnit && <span className="ui-price__unit">{d.pricePerUnit}</span>}
          {product.ribbons.length > 0 && (
            <span className="ui-price__badges">
              {product.ribbons.map((ribbon) => <span key={ribbon} className="ui-badge ui-badge--sale">{ribbon}</span>)}
            </span>
          )}
          {product.discountNames.length > 0 && <p className="ui-price__note">{product.discountNames.join(' · ')}</p>}
        </div>
        {summaryHtml && <div className="ui-pdp-summary pdp__summary" dangerouslySetInnerHTML={{ __html: summaryHtml }} />}

        {d.optionGroups.map((group) => (
          <OptionGroup key={group.id} group={group} onSelect={select} className={group.isColor ? 'pdp__color' : 'pdp__size'} />
        ))}

        <div className="pdp__buy-action">
        <div className="ui-buy-row">
          <button
            type="button"
            className="ui-button ui-button--primary ui-buy-row__cta"
            aria-disabled={blocked}
            aria-busy={d.adding}
            aria-describedby="pdp-status"
            onClick={addToCart}
          >
            <LoaderCircle className="ui-button__spinner" aria-hidden="true" />
            {!d.adding && <ShoppingBag aria-hidden="true" />}
            {d.adding ? 'Adding…' : d.isPreorder ? 'Pre-order' : 'Add to Cart'}
          </button>
          <button type="button" className="ui-icon-button ui-buy-row__wish ui-soon" aria-disabled="true" aria-label="Wishlist coming soon" title="Wishlist coming soon">
            <Heart aria-hidden="true" />
          </button>
        </div>
        <p id="pdp-status" className={`ui-status-line pdp__status${statusTone}`} role="status">{statusText}</p>
        </div>
      </div>
    </div>
  );
}
