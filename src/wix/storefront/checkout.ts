// Hosted checkout with our own return pages (plan 13). The kit's checkoutUrl() in ./cart.ts sends
// both callbacks to "/" and must not be edited, so this is its body with only `callbacks` changed:
// a finished order lands on /thank-you (Wix appends ?orderId=), and an abandoned or interrupted
// checkout comes back to /cart. Same request shape, same cart-core guards.
// docs: https://dev.wix.com/docs/api-reference/business-management/headless/redirects/create-redirect-session.md
import { currentCartV2 } from "@wix/ecom";
import { redirects as redirectsModule } from "@wix/redirects";
import { wixModule } from "../sdk";
import { assertCheckoutable, rawId } from "./cart-core";
import type { Raw } from "./catalog-core";

const cartApi = wixModule(currentCartV2);
const redirects = wixModule(redirectsModule);

/** The Wix-hosted checkout URL for the current cart. Call from the browser (the origin is the site's real one). */
export async function checkoutUrlWithReturn(): Promise<string> {
  const { cart } = await cartApi.getCurrentCart();
  const raw = cart as Raw;
  assertCheckoutable(raw);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const session = await redirects.createRedirectSession({
    ecomCheckout: { checkoutId: rawId(raw) },
    callbacks: { postFlowUrl: origin ? `${origin}/cart` : undefined, thankYouPageUrl: origin ? `${origin}/thank-you` : undefined },
  });
  const url = session?.redirectSession?.fullUrl;
  if (!url) throw new Error("Checkout couldn't start: no redirect URL returned.");
  return url;
}
