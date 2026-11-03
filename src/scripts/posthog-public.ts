// PostHog's public project token and host for server code (plan 13). Wix's backend-extension build
// resolves neither astro:env nor import.meta.env PUBLIC_* values, so the paid-order event reads them
// here. Both are public by design: the browser snippet ships them in every page (it reads the
// PUBLIC_POSTHOG_* env vars, which must match these). Change both together.
export const POSTHOG_PROJECT_TOKEN = 'phc_oVEZRd2Ra6u4tBnHqXEhvFf9ot3ZbExkUtWxD7iFXvmf';
export const POSTHOG_HOST = 'https://us.i.posthog.com';
