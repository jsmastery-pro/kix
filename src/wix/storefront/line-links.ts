// Product links for cart and order lines (plan 13). Wix's cart line carries no product URL (the
// kit's CartLine.productUrl is always ""), only `source.catalogReference.catalogItemId`, and the kit's
// mappers can't be edited. So: read the current cart once for each line's product ID, then the
// products' slugs in one query (the call the kit's cart.ts makes for line images). Both are cached
// for the session; a failure leaves names unlinked rather than breaking the cart.
// docs: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/purchase-flow/cart-v2/get-current-cart.md
// docs: https://dev.wix.com/docs/api-reference/business-solutions/stores/catalog-v3/products-v3/query-products.md
import { currentCartV2 } from "@wix/ecom";
import { productsV3 } from "@wix/stores";
import { wixModule } from "../sdk";
import { rawId } from "./cart-core";
import type { Raw } from "./catalog-core";

const cartApi = wixModule(currentCartV2);
const productsApi = wixModule(productsV3);

const lineProducts = new Map<string, string>();
const slugs = new Map<string, string>();

/** lineItemId -> product ID for the current cart's lines. Reads the cart only when a line is new. */
export async function fetchCartLineProducts(lineItemIds: readonly string[]): Promise<Map<string, string>> {
  if (lineItemIds.some((id) => !lineProducts.has(id))) {
    const { cart } = await cartApi.getCurrentCart();
    for (const line of ((cart as Raw)?.lineItems ?? []) as Raw[]) {
      const productId = line.source?.catalogReference?.catalogItemId;
      if (productId) lineProducts.set(rawId(line), productId);
    }
  }
  return new Map(lineItemIds.flatMap((id) => (lineProducts.has(id) ? [[id, lineProducts.get(id)!] as const] : [])));
}

/** product ID -> slug, one query for the IDs not seen yet. */
export async function fetchProductSlugs(productIds: readonly string[]): Promise<Map<string, string>> {
  const missing = [...new Set(productIds)].filter((id) => !slugs.has(id));
  if (missing.length) {
    const res = await productsApi.queryProducts().in("_id", missing).find();
    for (const product of (res.items ?? []) as Raw[]) if (product.slug) slugs.set(rawId(product), product.slug);
  }
  return new Map(productIds.flatMap((id) => (slugs.has(id) ? [[id, slugs.get(id)!] as const] : [])));
}
