// The header bag (plan 09): the same link as SiteLayout's IconButton, plus the live item count from
// the kit's cart store (shared with the product page, so an add updates it at once). Mounted
// client:only with the plain link as its server fallback, so the header never jumps. The bag still
// links to /cart, which the cart plan builds.
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../../hooks/storefront/useCart';

export default function BagButton() {
  const { itemCount } = useCart();
  const label = itemCount > 0 ? `Bag, ${itemCount} ${itemCount === 1 ? 'item' : 'items'}` : 'Bag';
  return (
    <a href="/cart" aria-label={label} title={label} className="ui-icon-button ui-icon-button--plain">
      <ShoppingBag aria-hidden="true" />
      {itemCount > 0 && <span className="ui-icon-button__count" aria-hidden="true">{itemCount > 99 ? '99+' : itemCount}</span>}
    </a>
  );
}
