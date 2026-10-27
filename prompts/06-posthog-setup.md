# 06 · PostHog setup: analytics, identity, errors and a starter dashboard

Status: approved

<!-- review → approved → done, or dropped. Only the user approves. -->

**Request:** "Read `.posthog/wizard-spellbook-FgsbwX/README.md` and complete the task described in the Wizard's spell books. Inspect what has already been done before making changes." The spell book's task is "Set up PostHog SDK integration" (Wizard program `posthog-integration`, detected framework Astro). Its docs: https://posthog.com/docs/libraries/astro and https://posthog.com/docs.

## Goal

When this plan is done:

- Every storefront page sends PostHog pageviews, autocaptured clicks, rage clicks and uncaught exceptions, with replay ready to switch on. Nothing it sends is personal data.
- A signed-in member's events join one PostHog person, keyed by their Wix member ID. Signing out starts a fresh anonymous person.
- The sign-in, create-account, email-code, password-reset, name and sign-out flows send typed events through one `track()` wrapper.
- The owner has an "Analytics basics" dashboard in PostHog, built from those events.
- With no PostHog settings, the site works the same and sends nothing. Dev logs a loud console error.

## Out of scope

- Server-side events and `posthog-node`. We have no first-party API routes: auth runs through `@wix/astro`'s built-in `/api/auth/*`, and checkout is Wix-hosted. Order events will come later from a Wix eCommerce event extension, in its own plan.
- Product, cart, customizer and 3D events. Those pages don't exist yet. Each feature plan adds its own events to the catalog.
- Feature flags, experiments, surveys, AI observability (there are no LLM calls) and logs.
- A reverse proxy (`/ingest`). It's a follow-up. Until then, ad blockers drop some events.
- Turning on session replay. Replay is a PostHog project setting. This plan only sets the privacy options so it's safe to turn on.
- Source map upload for readable stack traces. The `instrument-error-tracking` skill recommends it, but it needs `posthog-cli` (a new dependency) and a personal API key in the release flow. It's a follow-up and needs its own approval.
- The newsletter form. It has no backend and sends nothing, so there's no outcome to track.

## Decisions

### Setup

- Credentials come from the PostHog MCP (user's answer). `projects-get` returns `api_token` and `region`. If several projects come back, ask which one. Map `US` to `https://us.i.posthog.com` and `EU` to `https://eu.i.posthog.com`. Never assume US.
- The browser loads PostHog through the official web snippet (`is:inline`), not the `posthog-js` npm package (user's answer). That adds no dependency.
  - The snippet fetches the current posthog-js from PostHog's CDN (1.439.x on 2026-10-27).
  - `defaults: '2026-08-30'` is the newest value. It fixes the SDK's behavior, so CDN updates don't change it.
  - Until `array.js` loads, the snippet's stub only queues these methods: `capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagResult reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys getNextSurveyStep onSessionId`.
  - Anything else (`get_property`, `get_distinct_id`, `captureException`) waits for the SDK. `analytics.ts` holds those calls in a `whenReady(fn)` queue. It runs `fn` at once when `window.posthog?.__loaded` is true. Otherwise it queues `fn`, and init's `loaded` callback drains the queue.
- Env vars are `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST`.
  - Declare both in `astro.config.mjs` `env.schema` with `envField.string({ context: 'client', access: 'public', optional: true })`. Astro merges this with the schema `@wix/astro` injects through `updateConfig` (`node_modules/@wix/astro/build/integration/index.mjs` ~3579).
  - Set both with `wix env set`, and read them from `astro:env/client`.
  - The project token (`phc_…`) is public by design. We need no personal API key, so nothing new is secret.
- Missing config means no init. That applies when either var is missing, because the snippet builds its script URL from `api_host` and has no fallback.
  - In dev, the inline script throws `Error("<VAR> variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once <VAR> is configured")`, naming the first missing var. The throw is uncaught but stays inside that script, so the page still works.
  - Production does nothing.
  - Without `window.posthog`, every helper is a no-op.
- The design-system page (`DesignSystemLayout`) is internal and gets no PostHog.
- `.posthog/` (the wizard's spell books) goes into `.gitignore`.
- Work happens on a new branch, `feat/posthog-setup`, cut from `feat/wix-members`.

### Privacy (AGENTS.md: never send personal data or text the shopper typed)

- `identify()` sends the Wix member ID only. No email, name or photo (user's answer).
- `mask_all_element_attributes: true` stops autocapture from sending attributes from anywhere in the clicked element's chain.
  - Without it, `aria-label="Account menu for <name>"` and `data-*` values would be sent.
  - The cost: autocapture also loses `classes`, `id` and `href` (see Risks).
- `session_recording: { maskAllInputs: true, recordBody: false, recordHeaders: false }`.
  - An explicit client `false` beats the project's remote "capture network payloads" switch. So turning that switch on in PostHog can never record the password POST to `/api/auth/*`.
- `ph-no-capture` blocks an element, and everything inside it, in replay. A blocked node keeps only `class` and its layout. If any element in a click's chain has the class, autocapture drops the whole click. It goes on:
  - the header menu button `[data-account-button]` (its `aria-label` holds the name, and its avatar shows the photo or initial), and the menu's name and email lines;
  - `/account`'s avatar, its email value, and the `<strong>` holding the email in the reset intro;
  - the email-code step's `[data-verify-email]` span;
  - the forgot-password form's alert, whose confirmation repeats the typed email.
- `/account` no longer puts the email in an attribute on the page root (`data-login-email` on `[data-account]`), because replay records unblocked attributes.
  - The attribute moves onto the blocked `<strong data-login-email class="ph-no-capture">` in the reset intro.
  - `account.ts` reads it from there.
- Exception messages can carry Wix's server text: `@wix/sdk-runtime`'s `transform-error.js` folds the message, descriptions and `applicationError.data` into `error.message`.
  - `captureError(error, { area })` never sends the original error. It sends `new Error(`${area}: ${code}`)`, where `code` is `error.details?.applicationError?.code ?? error.name`, with `status` and `request_id` as properties when present.
  - A `before_send` hook covers uncaught errors, such as a rejected `logout()`. For `$exception` events, it replaces email-shaped text in each `$exception_list[].value` with `[email]`.
- PostHog's client `ip` option does nothing. Step 8 turns on the project setting "Discard client IP data" (`anonymize_ips`) through the PostHog MCP.
- Event property values are enums or Wix error codes, never typed text or Wix's error messages.
- Not set: `person_profiles`, which keeps the default `identified_only`, and `tracing_headers`, because there's no first-party backend.

### Events and identity

- Event names are snake_case, `object_verb`, past tense.
- Identity lives in `account-menu.ts`. It's on every `SiteLayout` page and already subscribes to the member store. When the member read settles:
  - **Member found:** call `identifyMember(member.id)`. Inside `whenReady`, if PostHog already holds a different identified user (`$user_state === 'identified'` and `get_distinct_id() !== id`), it calls `reset()` first, then `identify(id)`. Repeating the same ID sends nothing new.
  - **No member:** call `resetIdentity({ ifIdentified: true })`. Inside `whenReady`, it resets only if `get_property('$user_state') === 'identified'`, which covers an expired session. An ordinary anonymous load never resets.
- Signing out happens in three places.
  - **Header menu and `/account`:** native form POSTs. Those two forms get `data-signout="header|account"`. A capture-phase `submit` listener in `account-menu.ts` sends `track('signed_out', …, { beacon: true })`, then `resetIdentity()`. The stub queues `reset`, so it works before load.
  - **Auth form's "You're already signed in" action:** it calls `logout()`, which submits a form programmatically and fires no `submit` event. So it calls `track` (beacon) and `resetIdentity()` itself, before `logout()`.
- Google sign-in only shows us the click: `auth_submitted` with `method: 'google'`. The outcome happens on Wix's and Google's pages, so no `signed_in` is sent for Google. The member is still identified on the page they land on.
- On SUCCESS, the member store calls `location.assign` before it returns. `track(…, { beacon: true })` runs in the same task, and `sendBeacon` survives the navigation.

### Dashboard

- "Kix · Analytics basics" holds five insights. They are created through the PostHog MCP, following the `building-a-dashboard` skill: check the templates, `dashboard-create`, `insight-create`, then set the layout with `dashboard-update`.
- Insights use `filterTestAccounts: false`. On localhost, posthog-js marks visitors `$internal_or_test_user: true` (`internal_or_test_user_hostname` default), and test filtering would hide the verification events.
- The insights stay empty until events arrive.

## Context

- **Read:**
  - `AGENTS.md`; `package.json` and `npm ls` (astro 7.4.2, @wix/astro 3.1.0, no PostHog packages, no `posthog` code anywhere).
  - `astro.config.mjs` (`output: 'server'`, Wix hosting adapter, no CSP), `.gitignore`, and `.env.local` (key names only).
  - Layouts and components: `src/layouts/SiteLayout.astro`, `src/layouts/DesignSystemLayout.astro`, `src/components/AccountMenu.astro`, `src/components/ui/NewsletterForm.astro`.
  - Pages: `src/pages/{index,login,account}.astro`.
  - Scripts: `src/scripts/{auth-form,account-menu,account,password-reset,pending-profile,return-to}.ts`.
  - Members: `src/wix/members/{member-store,types,recovery}.ts`.
- **Spell books:**
  - `.posthog/wizard-spellbook-FgsbwX/README.md` has no skills, only doc links.
  - The earlier `.posthog/wizard-spellbook-DvT5my/skills/integration-astro-hybrid/` has Astro rules and an example project.
  - Nothing from either Wizard run reached the code.
- **Skills loaded:**
  - `posthog:instrument-product-analytics`, with its Astro SSR example and COMMANDMENTS.
  - `posthog:instrument-error-tracking`.
  - `posthog:building-a-dashboard`.
- **Docs:**
  - https://posthog.com/docs/libraries/astro (snippet, `is:inline`, `defaults: '2026-08-30'`)
  - https://posthog.com/docs/libraries/js/config (`defaults` history, `capture_exceptions`, `mask_all_element_attributes`, `before_send`)
  - https://posthog.com/docs/session-replay/privacy (`ph-no-capture`, `maskAllInputs`)
  - https://posthog.com/docs/session-replay/network-recording (`recordBody` and `recordHeaders`)
  - https://posthog.com/docs/product-analytics/autocapture
  - https://posthog.com/docs/getting-started/identify-users
- **Source checked by the plan reviewer:** posthog-js 1.439.1 and `@posthog/types` (option names, the `sendBeacon` transport, `$user_state`, `ph-no-capture` in autocapture and replay, the localhost test-user default).
- **Builds on:** plan 05 (Wix Members: member store, account menu, auth forms, sign-out routes).

## Approach

```
SiteLayout <head> ─ PostHog.astro (snippet + init, reads astro:env/client via define:vars)
                          │ window.posthog (stub, then the SDK)
src/scripts/analytics.ts ─┤ track(event, props, {beacon}) · identifyMember(id) · resetIdentity({ifIdentified})
   (typed catalog,        │ captureError(err, {area}) · whenReady(fn), drained by init's `loaded`
    whenReady queue)      │
callers: account-menu.ts (identify / reset, sign-out listener) · auth-form.ts · password-reset.ts · account.ts · pending-profile.ts
```

PostHog owns analytics, error tracking and replay (later). Nothing moves away from Wix.

### `src/components/PostHog.astro`

The frontmatter imports both vars from `astro:env/client`. The component renders one `<script is:inline define:vars={{ token, host, dev: import.meta.env.DEV }}>`. It holds PostHog's current web snippet, then:

```js
const missing = !token ? 'PUBLIC_POSTHOG_PROJECT_TOKEN' : !host ? 'PUBLIC_POSTHOG_HOST' : '';
if (missing) { if (dev) throw new Error(`${missing} variable required by PostHog is missing …`); }
else posthog.init(token, { api_host: host, defaults: '2026-08-30', capture_exceptions: true,
  mask_all_element_attributes: true,
  session_recording: { maskAllInputs: true, recordBody: false, recordHeaders: false },
  before_send: /* redact email-shaped text in $exception_list[].value */,
  loaded: () => window.__kixPosthogReady?.() });
```

`window.__kixPosthogReady` is set by `analytics.ts` to drain its queue. If the SDK loads before the module runs, `whenReady` sees `__loaded` and runs at once.

### `src/scripts/analytics.ts`

- Holds the `AnalyticsEvents` catalog type and a minimal `PostHogLike` interface on `Window`. The interface covers only what we call: `capture`, `identify`, `reset`, `captureException`, `get_property`, `get_distinct_id`, `__loaded`.
- Exports the helpers listed above.
- `track<E extends keyof AnalyticsEvents>(event: E, properties: AnalyticsEvents[E], options?: { beacon?: boolean })` maps `beacon` to `{ transport: 'sendBeacon' }`.
- Every helper swallows its own errors, so analytics never blocks the UI.
- `sign-out` and every other caller go through these helpers. Nothing calls `window.posthog` directly.

### Event catalog

| Event | Properties | Where it fires |
|---|---|---|
| `auth_submitted` | `flow: 'sign_in' \| 'create_account'`, `method: 'email' \| 'google'` | `auth-form.ts`: email submit after validation passes; Google click (after the terms check on create account) |
| `auth_failed` | `flow`, `step: 'credentials' \| 'email_code'`, `reason: string` | `auth-form.ts`, see the rules below |
| `email_code_requested` | `flow` | `auth-form.ts`: the credentials result is `EMAIL_VERIFICATION_REQUIRED` and the code step opens |
| `signed_in` | `method: 'email'` | `auth-form.ts`: login, or a sign-in email code, returns SUCCESS (beacon) |
| `account_created` | `method: 'email'` | `auth-form.ts`: register, or the code step in create-account mode, returns SUCCESS (beacon) |
| `password_reset_requested` | `source: 'forgot_password' \| 'account'`, `outcome: 'sent' \| 'rate-limited' \| 'failed'` | `password-reset.ts` `initForgotPassword`, and `account.ts` reset form |
| `profile_name_saved` | `source: 'account' \| 'signup'` | `account.ts` after `updateMemberName` succeeds; `pending-profile.ts` after the waiting name is saved |
| `signed_out` | `source: 'header' \| 'account' \| 'auth_page'` | the `data-signout` listener in `account-menu.ts`; the auth-form "Sign out" action |

`flow` comes from the form's `mode`: `'login'` becomes `'sign_in'` and `'register'` becomes `'create_account'`.

`auth_failed` fires with these values:

| Case | `step` | `reason` |
|---|---|---|
| Credentials submit returns anything but SUCCESS or EMAIL_VERIFICATION_REQUIRED | `credentials` | the Wix `errorCode`, else the `state` (for example `OWNER_APPROVAL_REQUIRED`) |
| Credentials submit throws (its catch) | `credentials` | `network` |
| Code step returns a non-SUCCESS result, including a repeat `EMAIL_VERIFICATION_REQUIRED` (wrong code, new one sent) | `email_code` | the `errorCode`, else the `state` |
| Code step throws (its catch) | `email_code` | `network` |

### Errors

- Uncaught exceptions and rejections are autocaptured (`capture_exceptions: true`). Console errors are not, which is the SDK default.
- `captureError` (sanitized, as described in Privacy) goes in the catch blocks that swallow an error today:
  - auth submit (`area: 'auth_submit'`)
  - email-code submit (`'auth_code'`)
  - `/account` name save (`'profile_save'`)
  - `applyPendingName` (`'pending_name'`)

### Dashboard: "Kix · Analytics basics"

1. Create-account funnel: `$pageview` with path `/create-account` → `auth_submitted` with `flow = create_account` → `account_created`, 14-day window.
2. Sign-in funnel: `auth_submitted` with `flow = sign_in` and `method = email` → `signed_in`.
3. Auth failures by reason: `auth_failed` trend, broken down by `reason`, as a bar chart.
4. Visitors: `$pageview` daily unique users over 30 days.
5. Password resets: `password_reset_requested` trend, broken down by `outcome`.

No new tokens, colors or UI. The markup changes are classes and data attributes, plus moving `data-login-email` on `/account`.

## Steps

- [ ] 1. **Credentials.** Cut branch `feat/posthog-setup`. Add `.posthog/` to `.gitignore`. Read the project through the PostHog MCP (`projects-get`). Then run:
  - `npm run wix env set -- --key PUBLIC_POSTHOG_PROJECT_TOKEN --value phc_…`
  - `npm run wix env set -- --key PUBLIC_POSTHOG_HOST --value https://<region>.i.posthog.com`
  - `npm run wix env pull`

  Check: `grep -c '^PUBLIC_POSTHOG_' .env.local` prints 2, without printing values.
- [ ] 2. **Env schema.** Declare both fields in `astro.config.mjs` `env.schema`.

  Check: `npm run check` passes, and `WIX_CLIENT_ID` still resolves from `astro:env/client`.
- [ ] 3. **Snippet.** Create `src/components/PostHog.astro` and render it in the `SiteLayout` `<head>`, after the font preload.

  Check:
  - With `npx astro dev --port 4321`, `/` sends a request to the PostHog host's `/e/` or `/i/v0/e/`, and PostHog shows a `$pageview` for `/`.
  - With `PUBLIC_POSTHOG_PROJECT_TOKEN=` overridden in the shell, the dev console shows the error naming that var and the page still works.
- [ ] 4. **Helpers.** Create `src/scripts/analytics.ts`: the catalog, the helpers, `whenReady`, and the `__kixPosthogReady` drain.

  Check: `npm run check` passes, and a deliberately wrong property in a scratch `track` call fails the type check (then remove it).
- [ ] 5. **Identity and sign-out.**
  - `account-menu.ts`: identify or reset in `render`, plus the capture-phase `data-signout` submit listener.
  - Add `data-signout` to the forms in `AccountMenu.astro` and `account.astro`.
  - `auth-form.ts`: the `ALREADY_LOGGED_IN` action sends `signed_out` (beacon) and calls `resetIdentity()` before `logout()`.

  Check:
  - Sign in with the plan 05 test member. That person's `distinct_id` in PostHog is the member ID. The person has no email or name properties; `$internal_or_test_user` from localhost is expected.
  - After signing out, `signed_out` is in PostHog, and the next pageview belongs to a new anonymous ID.
- [ ] 6. **Events and errors.** Add the catalog events and `captureError` calls in `auth-form.ts`, `password-reset.ts`, `account.ts` and `pending-profile.ts`.

  Check: `npm run check` passes, and each event appears in PostHog after doing its flow on localhost.
- [ ] 7. **Privacy markup.** Add `ph-no-capture` to the elements listed in Decisions, and move `data-login-email` on `/account`.

  Check:
  - An autocaptured click on `/account` has no `attr__*` and no member name in `$elements`.
  - A recording's snapshot for `/account`, read through the MCP with replay switched on briefly (or by checking `$snapshot` payloads in the network panel), doesn't contain the test email.
  - Screenshots at 1440 and 390 look the same as before.
- [ ] 8. **Dashboard and IP setting.** Create the dashboard and its five insights through the PostHog MCP. Turn on "Discard client IP data" on the project.

  Check: the dashboard URL opens and lists all five insights, and the project settings show `anonymize_ips: true`.
- [ ] 9. **Final check.** Run Verification (below), then a reviewer subagent compares the work with this plan.

Commit after each step's check passes.

## Files

- **Create:**
  - `src/components/PostHog.astro`
  - `src/scripts/analytics.ts`
- **Change:**
  - `astro.config.mjs`: env schema.
  - `.gitignore`: `.posthog/`.
  - `src/layouts/SiteLayout.astro`: `<PostHog />`.
  - `src/components/AccountMenu.astro`: `data-signout`, `ph-no-capture`.
  - `src/pages/account.astro`: `data-signout`, `ph-no-capture`, and the moved `data-login-email`.
  - `src/components/VerifyEmailForm.astro` and `src/pages/forgot-password.astro`: `ph-no-capture`.
  - `src/scripts/{account-menu,auth-form,password-reset,account,pending-profile}.ts`.
  - `prompts/README.md`: index.
- **Env:** `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST`, set on Wix and pulled into `.env.local`.
- **PostHog project:** `anonymize_ips` on, and the dashboard with its insights.

## Acceptance criteria

- WHEN any `SiteLayout` page loads with PostHog configured, THE SITE SHALL send one `$pageview` and autocapture clicks without element attributes.
- WHEN either PostHog var is missing, THE SITE SHALL render and behave unchanged, throw the named console error in dev only, and send nothing.
- WHEN a member's session is read, THE SITE SHALL identify them by Wix member ID only. If PostHog holds a different identified member, it resets first.
- WHEN a member signs out from any of the three places, THE SITE SHALL send `signed_out` and reset PostHog before the next page.
- WHEN a page loads for an anonymous visitor who was never identified, THE SITE SHALL NOT call `reset()`.
- WHEN a shopper completes or fails sign in, create account, the email code or a password reset, THE SITE SHALL send the matching catalog event, with only enum or Wix-error-code property values.
- WHEN a caught error is reported, THE SITE SHALL send only the area, Wix error code or error name, status and request ID. It never sends the original message.
- WHEN PostHog is blocked or throws, THE SITE SHALL keep every form working.
- WHEN replay is on, THE SITE SHALL mask inputs, block the elements listed in Decisions, and record no network bodies or headers. No member email, name or photo appears in a snapshot.

## Verification

- Run `npm run check` and `npm run build`, and show the output.
- In Claude in Chrome, on `http://localhost:4321`. This is a real browser, so PostHog's bot filter doesn't apply. With Playwright you'd need to override `navigator.webdriver`, the user agent and `userAgentData`, or debug with `?__posthog_debug=true`.
  1. Load `/`, `/login`, `/create-account`, `/forgot-password` and `/account`, and read the network requests to the PostHog host.
  2. Sign in as the plan 05 test member, sign out from the header, sign in again, and sign out from `/account`.
  3. Submit a wrong password.
  4. Send one password reset from `/forgot-password`. This counts toward Wix's daily email limit.
- Query PostHog through the MCP (HogQL, last hour) for events by name and person.
  - The report shows a table: each catalog event seen, its properties, and the person's `distinct_id`, with no email or name properties.
  - Inspect one `$autocapture` from `/account` and one `$exception` for leaks.
- Turn the token off: the dev console shows the error. A build with neither var set succeeds (`PUBLIC_POSTHOG_PROJECT_TOKEN= PUBLIC_POSTHOG_HOST= npm run build`).
- Take screenshots at 1440 and 390 of `/` and `/account`. Nothing should change visually, so this is a smoke check, not a design comparison.
- Report the dashboard URL and the `anonymize_ips` setting.

## Risks and open questions

- The CDN snippet always loads the newest posthog-js. `defaults` holds behavior steady, but a bad release would reach us without a deploy. The npm package was the alternative, declined because it's a dependency.
- `mask_all_element_attributes` also strips `href`, classes and IDs from autocapture. Heatmaps and autocapture insights will mostly show tag names and visible text. Our catalog events carry the meaning instead. If this proves too thin, the follow-up is `css_selector_ignorelist` and `ph-no-capture` on specific elements instead of masking everything.
- Wix hosting may add a Content-Security-Policy later. It would then need `https://*.posthog.com` in `script-src` and `connect-src`. There is none today.
- Ad blockers drop some events until a reverse proxy exists.
- Email signup is still blocked by reCAPTCHA (plan 05). So `account_created` can only be checked by type, plus the code-step path if Wix allows it. Google signups send no `account_created`.
- Stack traces stay minified until source maps are uploaded (follow-up).
- Costs: PostHog free tier, no Wix AI credits, and one password-reset email during testing.

## Result

Filled at close-out.
