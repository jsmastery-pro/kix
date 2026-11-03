// The one door to PostHog (plan 06). PostHog.astro loads the web snippet into window.posthog; pages
// call these helpers, never window.posthog. Every event and its properties live in the catalog
// below. Property values are enums or Wix error codes: never personal data, text the shopper typed,
// or Wix's error messages (AGENTS.md). Analytics never blocks the UI, so every helper swallows its
// own errors and does nothing when PostHog isn't configured.
import type { ResetOutcome } from '../wix/members/recovery';

export type AuthFlow = 'sign_in' | 'create_account';

export interface AnalyticsEvents {
  auth_submitted: { flow: AuthFlow; method: 'email' | 'google' };
  /** `reason` is a Wix error code, a non-SUCCESS state, or 'network'. */
  auth_failed: { flow: AuthFlow; step: 'credentials' | 'email_code'; reason: string };
  email_code_requested: { flow: AuthFlow };
  signed_in: { method: 'email' };
  account_created: { method: 'email' };
  password_reset_requested: { source: 'forgot_password' | 'account'; outcome: ResetOutcome };
  profile_name_saved: { source: 'account' | 'signup' };
  signed_out: { source: 'header' | 'account' | 'auth_page' };
  /** Which explore filter changed (plan 08). `category` is the page's category slug or 'all'; never the search text or values. */
  catalog_filtered: { filter: 'category' | 'price' | 'color' | 'search' | 'clear'; category: string };
  /** A successful add from the product page (plan 09). `product_id` is the Wix catalog ID, not personal data. `customized`: added with a design code (plan 13). */
  product_added_to_cart: { product_id: string; customized: boolean };
  /** The 3D view opened on the product page (plan 11), once per open. */
  product_3d_opened: { product_id: string; source: 'pill' | 'thumbnail' | 'design' };
  /** The 3D view fell back to photos (plan 11). */
  product_3d_failed: { product_id: string; reason: 'no_webgl' | 'load_error' | 'timeout' | 'context_lost' };
  /** The Customize panel opened in the 3D view (plan 12). Designs never send their colors. */
  design_customize_opened: { product_id: string };
  design_saved: { product_id: string; kind: 'new' | 'update' };
  /** `reason` is a Wix error code, an HTTP status, or 'network'. */
  design_save_failed: { product_id: string; reason: string };
  design_opened: { product_id: string; source: 'panel' | 'account' | 'resume' };
  design_deleted: { product_id: string };
  design_sign_in_prompted: { product_id: string };
  /** A ?code= design link opened in 3D (plan 13). Never the code itself. */
  design_code_opened: { product_id: string };
  /** Cart page changes (plan 13). The coupon text the shopper typed is never sent. */
  cart_quantity_changed: Record<string, never>;
  cart_line_removed: Record<string, never>;
  coupon_submitted: { outcome: 'applied' | 'rejected' };
  checkout_started: { item_count: number; customized_count: number };
  /** `reason` is a Wix error code or 'network'. */
  checkout_failed: { reason: string };
  /** The thank-you page showed an order (plan 13). Revenue comes from the server's order_paid. */
  order_completed: { order_id: string };
}

/**
 * Events sent from server code (plan 13) through analytics-server.ts, the server twin of track().
 * Same rules: no personal data. `order_paid` is the one revenue event, sent once per paid order.
 */
export interface ServerAnalyticsEvents {
  order_paid: { revenue: number; currency: string; order_id: string; order_number: number | null; item_count: number; customized_count: number };
}

export type ErrorArea = 'auth_submit' | 'auth_code' | 'profile_save' | 'pending_name' | 'cart_add' | 'model_load' | 'design_save' | 'design_list' | 'design_load' | 'design_delete' | 'cart_update' | 'checkout' | 'order_load' | 'order_list' | 'design_code';

/** The part of posthog-js we call. The snippet's stub queues capture, identify and reset until
 * the SDK loads; the getters and captureException exist only after (see whenReady). */
interface PostHogLogger {
  info(message: string, attributes?: Record<string, string>): void;
}

interface PostHogLike {
  __loaded?: boolean;
  logger?: PostHogLogger;
  capture(event: string, properties?: Record<string, unknown>, options?: { transport?: 'sendBeacon' }): void;
  identify(distinctId: string): void;
  reset(): void;
  captureException(error: unknown, properties?: Record<string, unknown>): void;
  get_property(name: string): unknown;
  get_distinct_id(): string;
}

declare global {
  interface Window {
    posthog?: PostHogLike;
    /** Called by PostHog.astro's `loaded` callback. */
    __kixPosthogReady?: (posthog: PostHogLike) => void;
  }
}

function safely(run: () => void) {
  try {
    run();
  } catch {
    /* analytics never breaks the page */
  }
}

const waiting: Array<(posthog: PostHogLike) => void> = [];

if (typeof window !== 'undefined') {
  window.__kixPosthogReady = (posthog) => {
    for (const run of waiting.splice(0)) safely(() => run(posthog));
  };
}

/** Runs `run` once the SDK has loaded (now, if it already has). Never runs without PostHog. */
function whenReady(run: (posthog: PostHogLike) => void) {
  const posthog = typeof window === 'undefined' ? undefined : window.posthog;
  if (!posthog) return;
  if (posthog.__loaded) safely(() => run(posthog));
  else waiting.push(run);
}

const isIdentified = (posthog: PostHogLike) => posthog.get_property('$user_state') === 'identified';

/** The only logger exported to PostHog; it deliberately does not capture existing console output. */
const posthogLog = {
  info(message: string, attributes: Record<string, string>) {
    whenReady((posthog) => posthog.logger?.info(message, attributes));
  },
};

/** Records an authentication completion without including member or credential data. */
export function logAuthenticationCompleted(flow: AuthFlow) {
  posthogLog.info('authentication_completed', { flow, method: 'email' });
}

/** Records that Wix accepted a password-reset request without including its email recipient. */
export function logPasswordResetRequested(source: 'forgot_password' | 'account') {
  posthogLog.info('password_reset_email_requested', { source });
}

/** Sends a catalog event. `beacon` survives a navigation that starts in the same task. */
export function track<E extends keyof AnalyticsEvents>(event: E, properties: AnalyticsEvents[E], options: { beacon?: boolean } = {}) {
  safely(() => window.posthog?.capture(event, { ...properties }, options.beacon ? { transport: 'sendBeacon' } : undefined));
}

/** Links this browser to a member by Wix member ID only. Switching members resets first. */
export function identifyMember(memberId: string) {
  whenReady((posthog) => {
    if (isIdentified(posthog) && posthog.get_distinct_id() !== memberId) posthog.reset();
    posthog.identify(memberId);
  });
}

/**
 * Starts a fresh anonymous person (sign out). With `ifIdentified`, only when PostHog still holds a
 * member, e.g. after the session expired; an ordinary anonymous visit keeps its ID and history.
 */
export function resetIdentity(options: { ifIdentified?: boolean } = {}) {
  if (!options.ifIdentified) {
    safely(() => window.posthog?.reset());
    return;
  }
  whenReady((posthog) => {
    if (isIdentified(posthog)) posthog.reset();
  });
}

interface WixErrorLike {
  name?: string;
  code?: string;
  status?: number;
  requestId?: string;
  details?: { applicationError?: { code?: string }; validationError?: unknown; requestId?: string };
}

/**
 * Reports a caught error. Wix SDK errors fold the server's message and data into `message`, so
 * this sends a new error named by area and code, never the original message.
 */
export function captureError(error: unknown, area: ErrorArea) {
  const wix = (typeof error === 'object' && error !== null ? error : {}) as WixErrorLike;
  const code = wix.details?.applicationError?.code
    ?? (wix.details?.validationError ? 'INVALID_ARGUMENT' : undefined)
    ?? wix.code
    ?? (error instanceof Error ? error.name : typeof error);
  const requestId = wix.requestId ?? wix.details?.requestId;
  whenReady((posthog) => {
    posthog.captureException(new Error(`${area}: ${code}`), {
      area,
      ...(typeof wix.status === 'number' && { status: wix.status }),
      ...(requestId && { request_id: requestId }),
    });
  });
}
