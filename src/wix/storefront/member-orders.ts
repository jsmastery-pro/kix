// The signed-in member's orders for /account (plan 13). Server code: the page calls it only after
// fetchCurrentMember() returned the member, and the filter pins the buyer to that member's ID.
// Search Orders sorts newest first by default and leaves out PENDING, REJECTED and INITIALIZED
// orders. One sub-request, plus one for the lines' product slugs.
// docs: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/search-orders.md
import { orders } from "@wix/ecom";
import { wixModule } from "../sdk";
import type { Raw } from "./catalog-core";
import { toOrder, withSlugs, type OrderSummary } from "./orders";

const ordersApi = wixModule(orders);

export async function fetchMemberOrders(memberId: string, limit = 10): Promise<OrderSummary[]> {
  const res = await ordersApi.searchOrders({ filter: { "buyerInfo.memberId": { $eq: memberId } }, cursorPaging: { limit } });
  const list = ((res?.orders ?? []) as Raw[]).map(toOrder);
  return withSlugs(list);
}
