// The cart page's island (plan 13): the design's lines, order summary and promo code on the kit's
// useCart (Cart V2, totals from Wix's estimate). Rendered client-only: the cart lives in the
// visitor's Wix session. Checkout goes to Wix's hosted checkout through checkoutUrlWithReturn(), so
// a finished order lands on /thank-you and an abandoned one comes back here. Lines link to their
// product through line-links.ts (Wix's cart lines carry no URL); a customized pair shows its design
// code with a link that reopens it in 3D. Shipping and tax are "calculated at checkout" (kit rule).
import { ArrowRight, CircleHelp, LoaderCircle, Minus, Package, Plus, ShieldCheck, Tag, Trash2, Truck, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useCart } from '../../hooks/storefront/useCart';
import { captureError, track } from '../../scripts/analytics';
import { designLink, findDesignCode, isCustomCode } from '../../wix/models/design-code';
import { imgAttrs } from '../../wix/media';
import { cartErrorMessage, errorCode } from '../../wix/storefront/cart-core';
import { checkoutUrlWithReturn } from '../../wix/storefront/checkout';
import { fetchCartLineProducts, fetchProductSlugs } from '../../wix/storefront/line-links';
import type { CartLine } from '../../wix/storefront/types';
import type { TileTone } from '../ui/tones';

// The design's tile order for the line photos.
const LINE_TONES: TileTone[] = ['peach', 'mint', 'lilac'];

// Wix's line statuses in buyer words (as the kit's CartDrawer words them); IN_STOCK says nothing.
function lineStatusCopy(line: CartLine): string | null {
  switch (line.status) {
    case 'IN_STOCK': return null;
    case 'PARTIALLY_IN_STOCK': return line.availableQuantity !== null ? `Only ${line.availableQuantity} available. Lower the quantity.` : 'Only part of this quantity is available.';
    case 'REMOVED_FROM_CATALOG': return 'No longer sold.';
    case 'OUT_OF_STOCK': return 'Out of stock.';
    default: return 'No longer available at this quantity.';
  }
}

/** A line's description split the way the design shows it: the color alone, a design code apart, the rest as "Label: value". */
export function lineParts(descriptionLines: readonly string[]) {
  const found = findDesignCode(descriptionLines);
  let color: string | null = null;
  const rest: string[] = [];
  for (const text of descriptionLines) {
    if (found && text.includes(found)) continue;
    const match = text.match(/^Colou?r:\s*(.+)$/i);
    if (match && color === null) color = match[1];
    else rest.push(text);
  }
  return { code: found && isCustomCode(found) ? found : null, color, rest };
}

// The kit's cart.ts rethrows Wix failures with buyer copy for the codes it knows, else with the SDK's
// message, which is raw JSON. Codes it doesn't map (seen live) get our copy; JSON never reaches the page.
const MORE_CART_ERRORS: Record<string, string> = {
  INVALID_COUPON_CODE: "That code doesn't exist. Check it and try again.",
};

function wixCode(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message.trim() : '';
  if (message.startsWith('{')) {
    try {
      const code = JSON.parse(message)?.details?.applicationError?.code;
      if (typeof code === 'string') return code;
    } catch {
      /* not JSON after all */
    }
  }
  return errorCode(error);
}

function buyerMessage(error: unknown, fallback: string): string {
  const code = wixCode(error);
  if (code && MORE_CART_ERRORS[code]) return MORE_CART_ERRORS[code];
  const message = cartErrorMessage(error, fallback);
  return message.trim().startsWith('{') ? fallback : message;
}

const reasonOf = (error: unknown) => wixCode(error) ?? (error instanceof TypeError ? 'network' : 'unknown');

export default function CartView() {
  const c = useCart();
  const cart = c.cart;
  const lines = cart?.lines ?? [];
  const [slugs, setSlugs] = useState<Map<string, string>>(new Map());
  const [lineError, setLineError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [promo, setPromo] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  const promoRef = useRef<HTMLInputElement>(null);

  // Product links for the lines: read only when a line is new (cached in line-links.ts).
  const lineKey = lines.map((line) => line.lineItemId).join(',');
  useEffect(() => {
    if (!lineKey) return;
    let live = true;
    const ids = lineKey.split(',');
    void (async () => {
      try {
        const products = await fetchCartLineProducts(ids);
        const bySlug = await fetchProductSlugs([...products.values()]);
        if (live) setSlugs(new Map(ids.flatMap((id) => (products.has(id) && bySlug.has(products.get(id)!) ? [[id, bySlug.get(products.get(id)!)!] as const] : []))));
      } catch {
        /* names stay unlinked: the cart still works */
      }
    })();
    return () => { live = false; };
  }, [lineKey]);

  // Back from checkout through the browser's back/forward cache: the page comes back mid-redirect.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => { if (event.persisted) setCheckingOut(false); };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  const busy = c.busy || checkingOut;
  const itemCount = cart?.itemCount ?? 0;
  const blocked = lines.some((line) => line.status !== 'IN_STOCK');
  const customizedCount = lines.filter((line) => lineParts(line.descriptionLines).code).reduce((n, line) => n + line.quantity, 0);

  async function changeQuantity(line: CartLine, quantity: number) {
    if (busy || quantity < 1) return;
    setLineError(null);
    try {
      await c.updateQuantity(line.lineItemId, quantity);
      track('cart_quantity_changed', {});
      setAnnouncement(`${line.productName} quantity ${quantity}.`);
    } catch (error) {
      captureError(error, 'cart_update');
      setLineError(buyerMessage(error, "We couldn't update your bag. Try again."));
    }
  }

  async function remove(line: CartLine) {
    if (busy) return;
    setLineError(null);
    try {
      await c.removeLine(line.lineItemId);
      track('cart_line_removed', {});
      setAnnouncement(`Removed ${line.productName}.`);
      titleRef.current?.focus();
    } catch (error) {
      captureError(error, 'cart_update');
      setLineError(buyerMessage(error, "We couldn't update your bag. Try again."));
    }
  }

  async function applyPromo(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!promo.trim()) {
      setPromoError('Enter a promo code.');
      promoRef.current?.focus();
      return;
    }
    setPromoError(null);
    try {
      await c.applyCoupon(promo);
      track('coupon_submitted', { outcome: 'applied' });
      setPromo('');
      setAnnouncement('Promo code applied.');
    } catch (error) {
      track('coupon_submitted', { outcome: 'rejected' });
      setPromoError(buyerMessage(error, "That code didn't work. Check it and try again."));
      promoRef.current?.focus();
    }
  }

  async function removePromo() {
    if (busy) return;
    setPromoError(null);
    try {
      await c.removeCoupon();
      setAnnouncement('Promo code removed.');
      promoRef.current?.focus();
    } catch (error) {
      captureError(error, 'cart_update');
      setPromoError(buyerMessage(error, "We couldn't remove the code. Try again."));
    }
  }

  async function checkout() {
    if (busy || blocked || lines.length === 0) return;
    setCheckoutError(null);
    setCheckingOut(true);
    try {
      const url = await checkoutUrlWithReturn();
      track('checkout_started', { item_count: itemCount, customized_count: customizedCount }, { beacon: true });
      window.location.href = url;
    } catch (error) {
      captureError(error, 'checkout');
      track('checkout_failed', { reason: reasonOf(error) });
      setCheckoutError(buyerMessage(error, "We couldn't start checkout. Try again."));
      setCheckingOut(false);
    }
  }

  const head = (
    <div className="cart__head">
      <h1 ref={titleRef} tabIndex={-1} className="ui-page-title ui-page-title--lg">Your Cart</h1>
      <p className="ui-page-count cart__count">
        {cart ? `${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : <span className="ui-skeleton-line cart__count-skeleton" aria-hidden="true" />}
      </p>
    </div>
  );
  const continueLink = (
    <a className="ui-arrow-link cart__continue" href="/shop">Continue Shopping<ArrowRight aria-hidden="true" /></a>
  );
  const live = <p className="sr-only" aria-live="polite">{announcement}</p>;

  if (!cart) return <CartSkeleton head={head} continueLink={continueLink} />;

  if (lines.length === 0) {
    return (
      <div className="cart cart--empty">
        {head}
        {continueLink}
        <div className="cart__lines ui-empty">
          <p className="ui-empty__title">Your bag is empty.</p>
          <p className="ui-empty__text">Find a pair, spin it in 3D and make it yours.</p>
          <div className="ui-empty__actions"><a className="ui-button ui-button--primary ui-button--lg" href="/shop">Find Your Pair</a></div>
        </div>
        {live}
      </div>
    );
  }

  const discounts = cart.discounts.length > 0 ? cart.discounts : cart.discount ? [{ name: 'Discount', amount: cart.discount }] : [];

  return (
    <div className="cart">
      {head}
      {continueLink}

      <div className="cart__lines">
        {lineError && <p className="ui-status-line ui-status-line--error cart__error" role="alert">{lineError}</p>}
        <ul className="ui-cart-lines ui-busy" aria-busy={c.busy} aria-label="Items in your bag">
          {lines.map((line, index) => {
            const { code, color, rest } = lineParts(line.descriptionLines);
            const slug = slugs.get(line.lineItemId);
            const status = lineStatusCopy(line);
            const atMax = line.availableQuantity !== null && line.quantity >= line.availableQuantity;
            const image = imgAttrs(line.imageUrl, '(min-width: 768px) 22vw, 112px', 274 / 306);
            return (
              <li key={line.lineItemId} className="ui-cart-line">
                <span className={`ui-photo ui-cart-line__media ui-tone--${LINE_TONES[index % LINE_TONES.length]}`}>
                  {'src' in image ? <img {...image} alt="" /> : <span className="ui-photo__fallback">Image placeholder</span>}
                </span>
                <div className="ui-cart-line__body">
                  <div className="ui-cart-line__top">
                    <h2 className="ui-cart-line__name">
                      {slug ? <a href={`/products/${encodeURIComponent(slug)}`}>{line.productName}</a> : line.productName}
                      {code && <span className="ui-badge ui-badge--custom">Custom</span>}
                    </h2>
                    <p className="ui-cart-line__price">
                      <span>{line.linePrice}</span>
                      {line.compareAtLinePrice && <s><span className="sr-only">Was </span>{line.compareAtLinePrice}</s>}
                    </p>
                  </div>
                  {color && <p className="ui-cart-line__color">{color}</p>}
                  {rest.map((text) => <p key={text} className="ui-cart-line__meta">{text}</p>)}
                  {line.subscription && <p className="ui-cart-line__meta">{line.subscription}</p>}
                  {code && (
                    <p className="ui-cart-line__design">
                      Design {code}
                      {slug && <> · <a href={designLink(slug, code, color)}>See it in 3D</a></>}
                    </p>
                  )}
                  {status && <p className="ui-cart-line__status">{status}</p>}
                </div>
                <div className="ui-cart-line__actions">
                  <div className="ui-quantity ui-quantity--cart">
                    <button type="button" aria-label={`Decrease quantity of ${line.productName}`} disabled={busy || line.quantity <= 1} onClick={() => changeQuantity(line, line.quantity - 1)}><Minus aria-hidden="true" /></button>
                    <output aria-label={`Quantity of ${line.productName}`}>{line.quantity}</output>
                    <button type="button" aria-label={`Increase quantity of ${line.productName}`} disabled={busy || atMax} onClick={() => changeQuantity(line, line.quantity + 1)}><Plus aria-hidden="true" /></button>
                  </div>
                  <button type="button" className="ui-text-button ui-cart-line__remove" aria-label={`Remove ${line.productName}`} disabled={busy} onClick={() => remove(line)}>
                    <Trash2 aria-hidden="true" />Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="cart__aside">
        <section className="ui-form-card ui-summary" aria-labelledby="cart-summary-title">
          <h2 id="cart-summary-title" className="ui-summary__title">Order Summary</h2>
          <dl className="ui-summary__rows">
            <div className="ui-summary__row"><dt>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</dt><dd>{cart.subtotal}</dd></div>
            <div className="ui-summary__row ui-summary__row--pending">
              <dt>
                Shipping
                <span className="ui-summary__help" title="Shipping is worked out at checkout from your address." aria-hidden="true"><CircleHelp /></span>
              </dt>
              <dd>Calculated at checkout<span className="sr-only">. Shipping is worked out at checkout from your address.</span></dd>
            </div>
            {cart.taxes.length > 0
              ? cart.taxes.map((tax) => <div key={tax.name} className="ui-summary__row"><dt>{tax.name || 'Tax'}</dt><dd>{tax.amount}</dd></div>)
              : !cart.pricesIncludeTax && <div className="ui-summary__row ui-summary__row--pending"><dt>Tax</dt><dd>Calculated at checkout</dd></div>}
            {cart.fees.map((fee) => <div key={fee.name} className="ui-summary__row"><dt>{fee.name}</dt><dd>{fee.amount}</dd></div>)}
            {discounts.map((discount) => (
              <div key={discount.name} className="ui-summary__row ui-summary__row--discount"><dt>{discount.name}</dt><dd>−{discount.amount}</dd></div>
            ))}
          </dl>
          <dl className="ui-summary__total"><dt>Total</dt><dd>{cart.total || cart.subtotal}</dd></dl>
          <p className="ui-summary__note">Shipping and tax are added at checkout.</p>
          <button type="button" className="ui-button ui-button--primary ui-button--lg ui-summary__checkout" aria-disabled={busy || blocked} aria-busy={checkingOut} aria-describedby="cart-checkout-status" onClick={checkout}>
            <LoaderCircle className="ui-button__spinner" aria-hidden="true" />
            {checkingOut ? 'Opening checkout…' : 'Checkout'}
          </button>
          <p id="cart-checkout-status" className={`ui-status-line ui-summary__status${checkoutError ? ' ui-status-line--error' : ''}`} role="status">
            {checkoutError ?? (blocked ? 'Remove or change the items marked above.' : '')}
          </p>
        </section>

        <section className="ui-form-card ui-promo" aria-labelledby="cart-promo-title">
          <h2 id="cart-promo-title" className="ui-promo__title">Promo Code</h2>
          {cart.coupon ? (
            <div className="ui-promo__applied">
              <Tag aria-hidden="true" />
              <p>{cart.coupon.code} applied!</p>
              <button type="button" className="ui-icon-button ui-icon-button--plain ui-promo__remove" aria-label={`Remove code ${cart.coupon.code}`} disabled={busy} onClick={removePromo}><X aria-hidden="true" /></button>
            </div>
          ) : (
            <form className="ui-promo__row" onSubmit={applyPromo} noValidate>
              <label className="ui-field ui-promo__field">
                <span className="sr-only">Promo code</span>
                <input ref={promoRef} value={promo} onChange={(event) => setPromo(event.target.value)} placeholder="Enter promo code" autoComplete="off" autoCapitalize="characters" spellCheck={false} aria-invalid={promoError ? true : undefined} aria-describedby="cart-promo-status" />
              </label>
              <button type="submit" className="ui-button ui-button--primary ui-promo__apply" aria-disabled={busy}>Apply</button>
            </form>
          )}
          <p id="cart-promo-status" className="ui-status-line ui-status-line--error ui-promo__status" role="status">{promoError}</p>
          <ul className="ui-promo__perks">
            <li className="ui-promo__perk"><Truck aria-hidden="true" /><p><span className="ui-promo__perk-title">Shipping</span><span className="ui-promo__perk-text">Calculated at checkout</span></p></li>
            <li className="ui-promo__perk"><Package aria-hidden="true" /><p><span className="ui-promo__perk-title">Returns</span><span className="ui-promo__perk-text">Per our store policy</span></p></li>
            <li className="ui-promo__perk"><ShieldCheck aria-hidden="true" /><p><span className="ui-promo__perk-title">Secure Checkout</span><span className="ui-promo__perk-text">Hosted by Wix</span></p></li>
          </ul>
        </section>
      </div>
      {live}
    </div>
  );
}

/** The cart's shape while Wix's cart loads: two lines and the summary card. */
export function CartSkeleton({ head, continueLink }: { head?: ReactNode; continueLink?: ReactNode }) {
  return (
    <div className="cart" aria-busy="true">
      {head ?? (
        <div className="cart__head">
          <h1 className="ui-page-title ui-page-title--lg">Your Cart</h1>
          <p className="ui-page-count cart__count"><span className="ui-skeleton-line cart__count-skeleton" aria-hidden="true" /></p>
        </div>
      )}
      {continueLink ?? <a className="ui-arrow-link cart__continue" href="/shop">Continue Shopping<ArrowRight aria-hidden="true" /></a>}
      <div className="cart__lines">
        <p className="sr-only">Loading your bag</p>
        <ul className="ui-cart-lines" aria-hidden="true">
          {[0, 1].map((n) => (
            <li key={n} className="ui-cart-line ui-cart-line--skeleton">
              <span className="ui-cart-line__media ui-skeleton-block" />
              <div className="ui-cart-line__body">
                <span className="ui-skeleton-line" style={{ width: '55%' }} />
                <span className="ui-skeleton-line" style={{ width: '35%', marginTop: 12 }} />
                <span className="ui-skeleton-line" style={{ width: '20%', marginTop: 12 }} />
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="cart__aside" aria-hidden="true">
        <div className="ui-form-card ui-summary">
          <span className="ui-skeleton-line" style={{ width: '60%', height: 36 }} />
          <span className="ui-skeleton-line" style={{ marginTop: 28 }} />
          <span className="ui-skeleton-line" style={{ marginTop: 16 }} />
          <span className="ui-skeleton-line" style={{ marginTop: 28, height: 60 }} />
        </div>
      </div>
    </div>
  );
}
