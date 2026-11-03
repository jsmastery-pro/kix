// Every paid order to PostHog with its revenue (plan 13). Wix calls this on the live site when an
// order's payment status changes; it sends `order_paid` only on the change to PAID (not for an
// approved offline order that isn't paid yet). The member's Wix ID is the distinct ID, the same one
// the browser identifies with, so revenue joins their browsing; a guest's order gets its own ID with
// no person profile. No email, name, address or contact ID is sent, and no order ID either (Wix
// returns an order to anyone holding its ID), so the order number identifies it. One sub-request.
// docs: https://dev.wix.com/docs/api-reference/business-solutions/e-commerce/orders/orders/payment-status-updated.md
import { orders } from '@wix/ecom';
import { findDesignCode, isCustomCode } from '../../../../wix/models/design-code';
import { captureServer } from '../../../../scripts/analytics-server';

const text = (value: { original?: string | null; translated?: string | null } | null | undefined) => value?.translated ?? value?.original ?? '';

export default orders.onOrderPaymentStatusUpdated(async (event) => {
  const { order, previousPaymentStatus } = event.data;
  if (!order?._id || order.paymentStatus !== 'PAID' || previousPaymentStatus === 'PAID') return;
  const lines = order.lineItems ?? [];
  const customized = lines.filter((line) => {
    const code = findDesignCode((line.descriptionLines ?? []).map((d) => `${text(d.name)}: ${text(d.plainText) || text(d.colorInfo)}`));
    return code !== null && isCustomCode(code);
  });
  const memberId = order.buyerInfo?.memberId;
  try {
    await captureServer(
      'order_paid',
      {
        revenue: Number(order.priceSummary?.total?.amount ?? 0),
        currency: order.currency ?? '',
        order_number: order.number != null ? Number(order.number) : null,
        item_count: lines.reduce((n, line) => n + (line.quantity ?? 0), 0),
        customized_count: customized.reduce((n, line) => n + (line.quantity ?? 0), 0),
      },
      {
        distinctId: memberId ?? `order_${order.number ?? event.metadata._id}`,
        personProfile: Boolean(memberId),
        uuid: event.metadata._id ?? order._id,
        timestamp: event.metadata.eventTime ? new Date(event.metadata.eventTime) : new Date(),
      },
    );
    console.log('[order-paid] sent', order._id);
  } catch (error) {
    // Rethrown so Wix can retry; PostHog de-duplicates a retry by uuid and timestamp.
    console.error('[order-paid] PostHog capture failed', order._id, error);
    throw error;
  }
});
