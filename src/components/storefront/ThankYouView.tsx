// The thank-you page's island (plan 13). Wix's hosted checkout returns here with ?orderId=; the
// order is read in the browser as the shopper who placed it, so nobody else's order can show. There's
// no design for this page: design-system primitives in the cart's type. A missing or unreadable
// order still thanks the shopper. The bag is re-read so its count drops to 0. Revenue is counted on
// the server (order_paid); this page only marks the order as seen (order_completed), once.
import { useEffect, useState } from 'react';
import { useMember } from '../../hooks/members/useMember';
import { captureError, track } from '../../scripts/analytics';
import { designLink } from '../../wix/models/design-code';
import { imgAttrs } from '../../wix/media';
import { refreshCart } from '../../wix/storefront/cart-store';
import { fetchOrder, orderBadge, withSlugs, type OrderSummary } from '../../wix/storefront/orders';

type State = { kind: 'loading' } | { kind: 'ready'; order: OrderSummary } | { kind: 'fallback' };

const SEEN_KEY = 'kix-order-completed:';

function markSeen(orderId: string): boolean {
  try {
    if (sessionStorage.getItem(SEEN_KEY + orderId)) return false;
    sessionStorage.setItem(SEEN_KEY + orderId, '1');
    return true;
  } catch {
    return true;
  }
}

export default function ThankYouView() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const member = useMember();

  useEffect(() => {
    void refreshCart();
    const orderId = new URLSearchParams(location.search).get('orderId');
    if (!orderId) {
      setState({ kind: 'fallback' });
      return;
    }
    let live = true;
    void (async () => {
      try {
        const [order] = await withSlugs([await fetchOrder(orderId)]);
        if (!live) return;
        setState({ kind: 'ready', order });
        if (markSeen(order.id)) track('order_completed', { order_id: order.id });
      } catch (error) {
        captureError(error, 'order_load');
        if (live) setState({ kind: 'fallback' });
      }
    })();
    return () => { live = false; };
  }, []);

  const actions = (
    <div className="thanks__actions">
      <a className="ui-button ui-button--primary ui-button--lg" href="/shop">Keep Shopping</a>
      {member.member && <a className="ui-button ui-button--secondary ui-button--lg" href="/account#orders-title">See Your Orders</a>}
    </div>
  );

  if (state.kind === 'loading') {
    return (
      <div className="thanks" aria-busy="true">
        <h1 className="ui-page-title ui-page-title--lg">Thank You</h1>
        <p className="ui-page-count"><span className="ui-skeleton-line thanks__skeleton" aria-hidden="true" /><span className="sr-only">Loading your order</span></p>
      </div>
    );
  }

  if (state.kind === 'fallback') {
    return (
      <div className="thanks">
        <h1 className="ui-page-title ui-page-title--lg">Thank You</h1>
        <p className="ui-page-count">Your order is in.</p>
        <p className="thanks__text">Your confirmation has the details.</p>
        {actions}
      </div>
    );
  }

  const { order } = state;
  const badge = orderBadge(order);
  return (
    <div className="thanks">
      <h1 className="ui-page-title ui-page-title--lg">Thank You</h1>
      <p className="ui-page-count">{order.number ? `Order #${order.number} is in.` : 'Your order is in.'}</p>
      <section className="ui-form-card thanks__card" aria-labelledby="thanks-order-title">
        <div className="ui-order-head">
          <h2 id="thanks-order-title" className="ui-order-head__title">{order.number ? `Order #${order.number}` : 'Your order'}</h2>
          <span className={`ui-badge ui-badge--${badge.tone}`}>{badge.label}</span>
        </div>
        <ul className="ui-order-lines">
          {order.lines.map((line, index) => {
            const image = imgAttrs(line.imageUrl, '72px');
            return (
              <li key={`${line.productId}-${index}`} className="ui-order-line">
                <span className="ui-photo ui-order-line__media ui-tone--sand">
                  {'src' in image ? <img {...image} alt="" /> : <span className="ui-photo__fallback">Image placeholder</span>}
                </span>
                <div className="ui-order-line__body">
                  <p className="ui-order-line__name">
                    {line.productSlug ? <a href={`/products/${encodeURIComponent(line.productSlug)}`}>{line.name}</a> : line.name}
                    {line.quantity > 1 && <span className="ui-order-line__qty"> × {line.quantity}</span>}
                    {line.designCode && <span className="ui-badge ui-badge--custom">Custom</span>}
                  </p>
                  <p className="ui-order-line__meta">{[line.color, ...line.details].filter(Boolean).join(' · ')}</p>
                  {line.designCode && (
                    <p className="ui-order-line__design">
                      Design {line.designCode}
                      {line.productSlug && <> · <a href={designLink(line.productSlug, line.designCode, line.color)}>See it in 3D</a></>}
                    </p>
                  )}
                </div>
                <p className="ui-order-line__price">{line.price}</p>
              </li>
            );
          })}
        </ul>
        <dl className="ui-summary__total thanks__total"><dt>Total</dt><dd>{order.total}</dd></dl>
      </section>
      {actions}
    </div>
  );
}
