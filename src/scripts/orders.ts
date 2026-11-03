// /account's Orders card (plan 13): the list renders on the server; this script shows each order's
// date in the shopper's time zone and reports a failed server read to PostHog, which can't run on
// the server.
import { captureError } from './analytics';

const orderDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function initOrders(root: HTMLElement) {
  if (root.hasAttribute('data-orders-error')) captureError(new Error('orders read failed on the server'), 'order_list');
  for (const time of root.querySelectorAll<HTMLTimeElement>('time[data-order-date]')) {
    const date = new Date(time.dateTime);
    if (!Number.isNaN(date.getTime())) time.textContent = orderDate.format(date);
  }
}
