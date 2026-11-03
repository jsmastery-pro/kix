import { app } from '@wix/astro/builders';

import orderPaid from './extensions/backend/events/order-paid/order-paid.extension.ts';

export default app().use(orderPaid);