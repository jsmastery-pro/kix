// eCommerce orders as the shopper sees them (plan 13): the thank-you page reads one order in the
// browser, as the buyer (Get Order returns an order to a member or visitor only if they placed it),
// and the account page lists a member's orders on the server (member-orders.ts). Both map Wix's
// Order to the plain OrderSummary below. Client-safe. Lines carry their product ID; their slugs come
// from line-links.ts, since order lines have no product URL either.
// docs: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/get-order.md
import { orders } from "@wix/ecom";
import { findDesignCode, isCustomCode } from "../models/design-code";
import { imgSrc } from "../media";
import { wixModule } from "../sdk";
import { rawId } from "./cart-core";
import type { Raw } from "./catalog-core";
import { fetchProductSlugs } from "./line-links";

const ordersApi = wixModule(orders);

export interface OrderLine {
  productId: string | null;
  productSlug: string | null;
  name: string;
  quantity: number;
  imageUrl: string;
  /** The line's total after discounts and tax, formatted. */
  price: string;
  /** The Color line's value ("Black / Sail"), shown without its label. */
  color: string | null;
  /** Other description lines as "Label: value" (Size). */
  details: string[];
  /** A custom design code (KIX-…), else null. */
  designCode: string | null;
}

export interface OrderSummary {
  id: string;
  number: string | null;
  createdDate: string;
  /** Wix's PaymentStatus (PAID, NOT_PAID, PENDING, PARTIALLY_PAID, FULLY_REFUNDED…). */
  paymentStatus: string;
  /** Wix's OrderStatus (APPROVED, CANCELED, INITIALIZED…). */
  status: string;
  total: string;
  currency: string;
  itemCount: number;
  lines: OrderLine[];
}

const text = (value: Raw | string | null | undefined): string => (typeof value === "string" ? value : value?.translated ?? value?.original ?? "");
const money = (price: Raw | null | undefined): string => price?.formattedAmount || price?.amount || "";

function toLine(raw: Raw): OrderLine {
  const descriptions = ((raw.descriptionLines ?? []) as Raw[])
    .map((d) => {
      const label = text(d.name);
      const value = text(d.plainText) || text(d.colorInfo);
      return label && value ? `${label}: ${value}` : value || label;
    })
    .filter(Boolean);
  const found = findDesignCode(descriptions);
  let color: string | null = null;
  const details: string[] = [];
  for (const line of descriptions) {
    if (found && line.includes(found)) continue;
    const match = line.match(/^Colou?r:\s*(.+)$/i);
    if (match && color === null) color = match[1];
    else details.push(line);
  }
  return {
    productId: raw.catalogReference?.catalogItemId ?? null,
    productSlug: null,
    name: text(raw.productName),
    quantity: typeof raw.quantity === "number" ? raw.quantity : 1,
    imageUrl: raw.image ? imgSrc(raw.image, 300, 300) : "",
    price: money(raw.totalPriceAfterTax) || money(raw.price),
    color,
    details,
    designCode: found && isCustomCode(found) ? found : null,
  };
}

export function toOrder(raw: Raw): OrderSummary {
  const lines = ((raw.lineItems ?? []) as Raw[]).map(toLine);
  return {
    id: rawId(raw),
    number: raw.number != null ? String(raw.number) : null,
    createdDate: raw._createdDate ?? raw.createdDate ?? "",
    paymentStatus: raw.paymentStatus ?? "",
    status: raw.status ?? "",
    total: money(raw.priceSummary?.total),
    currency: raw.currency ?? "",
    itemCount: lines.reduce((n, line) => n + line.quantity, 0),
    lines,
  };
}

/** Fills each line's product slug (one product query). A failed read leaves the slugs null. */
export async function withSlugs(list: OrderSummary[]): Promise<OrderSummary[]> {
  const ids = list.flatMap((order) => order.lines.flatMap((line) => (line.productId ? [line.productId] : [])));
  if (!ids.length) return list;
  try {
    const slugs = await fetchProductSlugs(ids);
    return list.map((order) => ({ ...order, lines: order.lines.map((line) => ({ ...line, productSlug: (line.productId && slugs.get(line.productId)) || null })) }));
  } catch {
    return list;
  }
}

/** One order, read as the shopper who placed it. Throws when Wix refuses or can't find it. */
export async function fetchOrder(orderId: string): Promise<OrderSummary> {
  const order = await ordersApi.getOrder(orderId);
  if (!order) throw new Error("Order not found.");
  return toOrder(order as Raw);
}

/** The status badge for an order: Canceled first, then the payment status in buyer words. */
export function orderBadge(order: Pick<OrderSummary, "status" | "paymentStatus">): { label: string; tone: "success" | "limited" | "info" } {
  if (order.status === "CANCELED") return { label: "Canceled", tone: "info" };
  switch (order.paymentStatus) {
    case "PAID": return { label: "Paid", tone: "success" };
    case "PARTIALLY_PAID": return { label: "Partly paid", tone: "info" };
    case "FULLY_REFUNDED": return { label: "Refunded", tone: "info" };
    case "PARTIALLY_REFUNDED": return { label: "Partly refunded", tone: "info" };
    default: return { label: "Payment pending", tone: "limited" };
  }
}
