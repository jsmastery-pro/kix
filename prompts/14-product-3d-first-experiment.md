# 14 · Experiment: product page opens in 3D first vs photos first

Status: approved

<!-- review → approved → done, or dropped. Only the user approves. -->

**Request:** "Run a PostHog experiment that compares a product page showing 3D first with one showing photos first, using the PostHog creating experiments and instrument feature flags skills. Pick each visitor's version on the server so the page never flickers, and measure add to cart and completed orders."

## Goal

Half of the shoppers who open a product page that has a 3D model see the shoe open in 3D straight away. The other half see today's page: photos first, with 3D one press away. The server picks each shopper's version before it renders the page, so the first paint is already the right version. The page never swaps photos for 3D after loading, and a shopper keeps the same version on every product page and through sign-in. In PostHog, an experiment compares the two versions on adding to the cart and on completed orders, so the store owner can see whether 3D first sells more.

## Out of scope

- Changing the 3D viewer, the Customize panel or the photos themselves. The only change is which one the gallery opens with.
- 3D first on cards, the home page or the explore page.
- A PostHog reverse proxy. Today ad blockers already drop analytics, and they'd drop those shoppers' exposures too (see Risks).
- Shipping a winner. When the experiment ends, a later small change removes the flag and keeps the winning path.
- Launching the experiment without the user's say-so (see Steps 11 and 12).

## Decisions

- **Device-ID bucketing (user).** The flag hashes PostHog's `$device_id`, not the distinct ID. `identify()` changes the distinct ID at sign-in but keeps `$device_id`, so a shopper keeps their version when they sign in. A member on a second device can get the other version there (PostHog docs: device bucketing).
  - PostHog's "persist flag across authentication" option is out. It doesn't work with bootstrapping, and server-picked versions need bootstrapping.
  - posthog-js 1.444.0 sends `$device_id` on its own `/flags` calls (device IDs on flag requests need 1.307.1 or newer), so the browser's evaluation matches the server's.
- **All devices, 50/50, 100% of traffic (user).** Phones are in. A failed 3D load is a guardrail metric.
- **The experiment is created through the PostHog MCP after you authorize it (user).** I create it as a draft and add the metrics, then launch only when you say so.
- **Flag key `product-3d-first-experiment`, variants `control` (photos first, today's page) and `test` (3D first).** The `-experiment` suffix follows PostHog's naming advice. The baseline is keyed `control`, so PostHog analyses against it by default.
- **The server reads the flag over PostHog's `/flags` API, with no new dependency.**
  - The request is `POST {PUBLIC_POSTHOG_HOST}/flags/?v=2` with `{ token, distinct_id, $device_id, person_properties: { $device_id }, flag_keys_to_evaluate: [key] }`. This is the body `@posthog/core` 1.62.0 (inside posthog-js) builds: `$device_id` goes top level and in `person_properties`, as the Node SDK does.
  - The response's `flags[key].variant` is the version. It uses the public project token, so no secret is involved, the same as `analytics-server.ts`.
  - `posthog-node` would add a dependency. Its local evaluation needs a secret key and a polling process, which a Wix serverless request can't keep. One `fetch` does the same job.
- **The parser accepts a version only when** `flags[key].enabled === true`, `flags[key].failed` isn't true, and `flags[key].variant` is `'control'` or `'test'`. A response with `errorsWhileComputingFlags` or `quotaLimited` gives `null`.
- **Who the server is asking about.** It reads PostHog's own cookie, `ph_<token>_posthog`. That's `encodeURIComponent(JSON)` with `distinct_id`, `$device_id` and `$user_state`, the format of `@posthog/core`'s `parsePostHogCookie`. Astro already decodes cookie values, so read it with `JSON.parse(Astro.cookies.get(name)?.value)` in a try/catch, and don't decode it a second time. Our token has no `+ / =`, so the name needs no escaping.
  - **The cookie exists** (a returning visitor, or any second page): the server uses its `distinct_id` and `$device_id`, and bootstraps only the flag value. The browser keeps its own ID.
  - **No cookie** (a first visit that lands on a product page): the server makes a new UUIDv7 and uses it as both the distinct ID and the device ID. The page bootstraps `distinctID` with it, so posthog-js adopts it as both, the way posthog-js 1.444 handles an anonymous bootstrap ID.
  - **A cookie without `$device_id`** (older SDK cookies): the server skips the flag call. The visitor gets today's page and isn't counted.
  - **An unparseable cookie** is treated as no cookie.
- **The bootstrap rides through the layout.** `PostHog.astro` takes an optional `bootstrap` prop and passes it to `posthog.init({ bootstrap })`. `SiteLayout` takes `posthogBootstrap` and forwards it. Other pages pass nothing and are unchanged.
- **Who's in the experiment.** A shopper counts only when all of these hold:
  - the product has a 3D model (a `ProductModels` row);
  - the server got a version back;
  - the visit isn't a deep link that opens 3D anyway (`?design=`, `?code=`, `?resume=`). The page reads these and `pdp_variant` from `new URL(pageUrl).searchParams`. `pageUrl` is the URL it already builds, which prefers `x-wix-forwarded-url` on Wix hosting.

  Everyone else gets today's page, no bootstrapped flag and no exposure. All 12 Kix sneakers have models (plan 10).
- **Exposure is recorded in the browser.** `ProductView` gets `experiment: 'control' | 'test' | null`. When the island mounts with a version, `recordExposure('product-3d-first-experiment')` (new, in `analytics.ts`) calls `posthog.getFeatureFlag(key)` once the SDK loads. That sends PostHog's `$feature_flag_called` with the bootstrapped version (`$used_bootstrap_value: true`), which is the experiment's default exposure.
  - Bootstrapped flags are in place before posthog-js's `loaded` callback, so `whenReady` reads the server's version, not a later `/flags` response.
  - posthog-js sends that event once per key and version per visitor. It keeps the record in persistence and clears it only on an identity change, so it sends again after sign-in. A second product page or a reload sends nothing new. Later events carry the version as `$feature/product-3d-first-experiment`.
  - Calling it on the server wouldn't work: the server can't tell whether the page ever reached a browser that runs JS, and bots would count.
  - The flag's evaluation runtime stays "server and client". With server-only, the browser's next `/flags` response would drop the key and wipe the bootstrapped value (PostHog bootstrapping docs), and `$feature/product-3d-first-experiment` would vanish from later events.
- **What 3D first looks like.** `ProductGallery` gets `startIn3d`, and its initial `mode` is `startIn3d && model ? 'loading' : 'photos'`. The gallery starts in its existing loading state: the first photo, dimmed, with the spinner and "Loading 3D…". That state is in the server HTML, so it's the first paint. After hydration the lazy viewer loads, and the model fades in as it does today after a press.
  - The viewer renders only when `viewing3d && model && mounted`. `mounted` is set in a mount effect, so the server and the first browser render match. Astro streams React 18 SSR, and the server's lazy stub renders `null`, so without this gate hydration would meet a canvas the server never rendered.
  - `open3d()` returns early when the mode is already `loading`, so the mount effect does its work itself. With `startIn3d`, it runs `hasWebGL()`; with no WebGL it calls `fail('no_webgl')`. Otherwise it runs `setOpenPhoto(src)` (which `resolvePreset` reads) and tracks `product_3d_opened` with `source: 'auto'`. The existing 20 s timeout effect already starts at hydration, because the mode starts as `loading`.
  - Everything after that is today's 3D. The Photos pill and the thumbnails go to photos, color picks recolor the shoe, and Customize shows in 3D.
  - `product_3d_opened` gets a new `source: 'auto'`, so 3D opens can be compared across versions.
- **Fallback is today's.** No WebGL, a load error, a lost context or the 20 s timeout sends the shopper to photos with "3D view couldn't load. Showing photos." Every failure sends `product_3d_failed`. The shopper stays in the experiment, so its results count the version each visitor was given, whether or not their 3D loaded.
- **When the flag can't be read, the page is today's.** A 1500 ms timeout, an error or missing PostHog env vars → photos first, no bootstrap, no exposure, and one `console.warn` in the server log. Analytics never blocks the page (AGENTS.md).
- **Product pages become `Cache-Control: private, no-store`,** like `/cart`. Their HTML now differs per visitor (version and bootstrap ID), so a shared cache must never store one. It's set on every product page response, not only on experiment pages, so the rule is simple.
- **The flag call runs in the page's first wave**, in parallel with the product, SEO and categories reads, so it adds no wait in the usual case. That's 1 more sub-request per product page, well under 20 (AGENTS.md). It runs on every product page view, model or not. The model is only known in the second wave, and waiting for it would add the flag's latency.
- **A dev-only override for testing before launch.** While the experiment is a draft, its flag is off and returns no version. So in `npm run dev` / `astro dev` only (`import.meta.env.DEV`), `?pdp_variant=test|control` forces a version. It skips the flag call, bootstraps the forced version and records an exposure, so Step 6 can test the whole path. posthog-js marks localhost events as a test user (`internal_or_test_user_hostname`), so the experiment's test-account filter keeps them out. Production ignores the parameter.
- **Metrics. The event names exist in code, and Step 1 confirms them in PostHog.**
  - **Primary 1: add to cart.** A funnel from exposure to `product_added_to_cart` (one step).
  - **Primary 2: completed orders.** A funnel from exposure to `order_completed`. It fires on `/thank-you` in the shopper's own browser (plan 13), so guest orders count too.
  - **Secondary, revenue: the mean of `order_paid.revenue`.** Members only. A guest's `order_paid` uses an `order_<number>` ID that never meets their browser, so it's context, not a decision metric.
  - **Secondary, 3D engagement:** a funnel from exposure to `product_3d_opened`.
  - **Guardrail:** `product_3d_failed` per user.
  - Before building any of these inline, I search `experiment-saved-metrics-list` by event and reuse a shared metric that measures the same thing.
  - The test-account filter stays on. Multi-variant handling stays the default "Exclude from analysis", which is safe with an even split.
- **Two primary metrics, as asked.** Orders are much rarer than adds, so the running-time estimate (Step 1) may come out long. If it's over about 8 weeks, I'll say so and propose making orders secondary. You decide.
- **Stats follow the project's defaults.** No `stats_config`.

## Context

- **Skills loaded:**
  - `posthog:creating-experiments` and its `references/setup-decisions.md`.
  - `posthog:instrument-feature-flags`: `COMMANDMENTS.md`, `best-practices.md`, `api.md`.
  - `posthog:configuring-experiment-rollout`: bucketing, and the device-ID recipe.
  - `posthog:configuring-experiment-analytics`: exposure, metric types, shared-metric reuse.
- **PostHog docs:**
  - Device bucketing: https://posthog.com/docs/feature-flags/device-bucketing.md
  - Bootstrapping: https://posthog.com/docs/feature-flags/bootstrapping.md
  - Flags API: https://posthog.com/docs/api/flags
- **Installed sources read:**
  - posthog-js 1.444.0 `lib/src/posthog-core.js`: init bootstrap handling. An anonymous `bootstrap.distinctID` replaces the stored ID and sets `$device_id` to it. The cookie name is `ph_<token>_posthog`. Cookie properties include `$device_id`, `distinct_id` and `$user_state`.
  - `@posthog/core` 1.62.0 `dist/cookie.js` (`parsePostHogCookie`) and `dist/posthog-core-stateless.js` (`getFlags` body: `$device_id`, `flag_keys_to_evaluate`; v2 response normalized from `flags[key].variant`).
- **Code read:**
  - `src/pages/products/[slug].astro`, `ProductView.tsx`, `ProductGallery.tsx`.
  - `PostHog.astro`, `SiteLayout.astro`, `analytics.ts`, `analytics-server.ts`, `posthog-public.ts`, `astro.config.mjs`.
  - `src/styles/global.css` (gallery `data-mode` styles), `thank-you.astro`, `ThankYouView.tsx`, `order-paid.ts`.
- **Builds on:** plans 06 (PostHog setup), 11 (3D view), 13 (thank-you `order_completed`, server `order_paid`).
- **Not read: the PostHog project.** The PostHog MCP isn't authorized in this session, so event volumes, `$host`/`$pathname` shapes, earlier experiments, shared metrics and team defaults are unread. Step 1 reads them.

## Approach

```
browser ──GET /products/<slug> (cookie ph_<token>_posthog?)──▶ [slug].astro
  identity = cookie ? {distinct_id, $device_id} : fresh UUIDv7 for both
  wave 1 (parallel): product · SEO · categories · flags(identity)   ← +1 sub-request
  wave 2: lists · ProductModels row
  variant = model && !deepLink ? flags.variant : null
  headers: Cache-Control: private, no-store
  render: SiteLayout posthogBootstrap={variant ? {distinctID?: fresh, featureFlags: {key: variant}} : undefined}
          ProductView experiment={variant} → ProductGallery startIn3d={variant === 'test'}
browser: posthog.init({ bootstrap }) → island mounts → recordExposure(key) → $feature_flag_called
         product_added_to_cart / order_completed carry $feature/<key> → PostHog experiment
```

- **Who owns what:** PostHog owns assignment (the flag), exposure and analysis, through `analytics.ts` in the browser and the new `flags-server.ts` on the server. Wix still owns hosting, the product and the model. No Wix data changes.
- **`src/scripts/flags-server.ts` (new)** has three parts:
  - `readPostHogIdentity(cookies)` → `{ distinctId, deviceId } | null`. Invalid JSON gives `null`, the same as no cookie.
  - `newAnonymousId()`: a UUIDv7 from `crypto.getRandomValues` and the clock, the same format posthog-js makes.
  - `getExperimentVariant(key, identity)` → `'control' | 'test' | null`. It sends one `fetch` with `AbortSignal.timeout(1500)`, returns `null` on any failure, and never throws.

  It reads `PUBLIC_POSTHOG_PROJECT_TOKEN` and `PUBLIC_POSTHOG_HOST` from `astro:env/client`. Pages can read those; `posthog-public.ts` exists only for backend extensions.
- **The `analytics.ts` catalog gains:**
  - `ExperimentFlags { 'product-3d-first-experiment': 'control' | 'test' }`, the one place flag keys and variants live;
  - `recordExposure(key)`;
  - `getFeatureFlag` on `PostHogLike`;
  - `'auto'` in `product_3d_opened.source`.
- **No new tokens, secrets or Wix schema.** The only new browser event is PostHog's own `$feature_flag_called`. No personal data: the bootstrap ID is random, and no URL or typed text is added to any event.

## Steps

- [ ] 1. **Read the PostHog project** (after you authorize the PostHog MCP with `/mcp`).
  - Run `read-data-schema` for `product_added_to_cart`, `order_completed`, `order_paid`, `product_3d_opened` and `product_3d_failed`, and `$host`/`$pathname` values on `$pageview`.
  - Call `experiment-setup-context` once with `target_event: $pageview`, an exact `$host`, `target_url_contains: "/products/"`, `metric_event: product_added_to_cart` and `previous_experiments_limit: 5`.
  - Get the running time from `experiment-calculate-running-time`.
  - Check: the facts are printed in the report. Any event missing, or a running time over about 8 weeks, comes to you before Step 2.
- [ ] 2. **Make the flag and the experiment draft.**
  - Create the flag with `create-feature-flag`: key `product-3d-first-experiment`, `bucketing_identifier: "device_id"`, `active: false`, groups `[{ properties: [], rollout_percentage: 100 }]`, and variants control 50 / test 50.
  - Then `experiment-create` with that key, no `feature_flag` object, the hypothesis in `description` and `running_time_calculation` from Step 1.
  - Then `experiment-update` with the metrics in Decisions, reusing shared metrics where they match.
  - Check: `experiment-get` shows a draft, the flag inactive, device bucketing, five metrics, and the experiment URL.
- [ ] 3. **`flags-server.ts` and the `analytics.ts` additions.** Check: `npm run check` gives 0 errors, and a `curl` of `/flags/?v=2` with the same body returns the response shape the parser expects (flag inactive: no version, so `null`).
- [ ] 4. **Bootstrap through the layout.** Change `PostHog.astro` (`bootstrap` prop into `init`) and `SiteLayout.astro` (`posthogBootstrap` prop).
  - Check: the home page's inline script is unchanged apart from `bootstrap: undefined`.
  - Check: in the dev server, `posthog.get_distinct_id()` on `/` is the same before and after.
- [ ] 5. **Product page wiring** in `[slug].astro`: identity, the wave-1 flag call, `Cache-Control`, the deep-link and model gates, the dev override, and the props. Checks with `curl` against `astro dev`:
  - with no cookie and `?pdp_variant=test`, the HTML has `data-mode="loading"`, and the bootstrap holds a UUIDv7 `distinctID` and `featureFlags`;
  - with a PostHog cookie, the bootstrap has no `distinctID`;
  - `?pdp_variant=control` gives today's HTML;
  - with no override (flag inactive), there's no bootstrap;
  - `?code=…&pdp_variant=test` gives no bootstrap;
  - the `-I` headers show `Cache-Control: private, no-store`.
- [ ] 6. **Gallery and island.** `ProductGallery` gets `startIn3d` (initial `loading` mode, the `mounted` gate, auto-open with `source: 'auto'`). `ProductView` gets `experiment`, passes `startIn3d` and calls `recordExposure` on mount. Checks in Chrome:
  - **Test:** the first paint is the loading state, with no photos→3D swap (a performance trace's first screenshot), and the model then shows.
  - **Control:** today's page.
  - **Fallbacks:** a `getContext` stub that returns `null` falls back to photos with the note and sends `product_3d_failed` `no_webgl`.
  - **Navigation:** Photos, thumbnails, color picks and Customize work in test.
  - **Deep links:** `?code=` still opens the design.
  - **Clean console:** no hydration warning in either version.
  - **Exposure:** with `?pdp_variant=test` in a fresh profile, the Network panel's `/e/` payload has `$feature_flag_called` with `$feature_flag: "product-3d-first-experiment"` and `$feature_flag_response: "test"`. A second product page sends no new one, and its `$pageview` carries `$feature/product-3d-first-experiment: "test"`.
- [ ] 7. **Layouts.** Compare `/products/<slug>` in both versions at 1440 and 390 (390 through a same-origin iframe) with today's page. The only difference should be the frame's starting state. Check: screenshots, and no horizontal overflow at 390.
- [ ] 8. **Checks.** Check: `npm run check` and `npm run build` both pass, and `dist/server` doesn't contain three.
- [ ] 9. **Review.** A reviewer subagent compares the work with this plan, and I fix the real gaps.
- [ ] 10. **Release, after you approve it.** Run `npm run release -- --version-type minor --comment "Product page 3D-first experiment wiring (plan 14)"`. Check, on the live site with the flag still inactive:
  - every product page is today's page;
  - the response has `Cache-Control: private, no-store`;
  - a `?code=` design link still opens in 3D;
  - `?pdp_variant=test` is ignored.
- [ ] 11. **Pre-launch gate.** Plan 13 must be released, and `order_completed` and `order_paid` seen in PostHog for a test order. Otherwise completed orders can't be measured. I report the state and wait.
- [ ] 12. **Launch, only when you say so.** Run `experiment-launch`. Check on the live site:
  - in two fresh browser profiles, the first product page's version matches its `$feature_flag_called` variant in PostHog's activity, and later product pages and a reload show the same version and carry it as `$feature/product-3d-first-experiment`;
  - signing in keeps the version;
  - `product_added_to_cart` carries `$feature/product-3d-first-experiment`;
  - the experiment page shows exposures in both versions.
- [ ] 13. **Close out.** Write the Result, set `Status: done`, update the index, and propose AGENTS.md edits (below).

## Files

- **Create:**
  - `src/scripts/flags-server.ts`
- **Change:**
  - `src/scripts/analytics.ts`
  - `src/components/PostHog.astro`
  - `src/layouts/SiteLayout.astro`
  - `src/pages/products/[slug].astro`
  - `src/components/storefront/ProductView.tsx`
  - `src/components/ui/ProductGallery.tsx`
  - `prompts/README.md`
- **In PostHog:** the flag `product-3d-first-experiment` and the experiment "Product page: 3D first vs photos first".
- **At close-out, proposed for AGENTS.md:**
  - The "Analytics, replay, flags, experiments" line gains: server-picked flags via `flags-server.ts` and the PostHog cookie, bootstrap through `SiteLayout`, and exposure via `recordExposure`.
  - "Who owns what" notes that product pages are `private, no-store`.

## Acceptance criteria

- WHEN a shopper in `test` opens a product page that has a model THE SITE SHALL render the gallery in its loading-3D state in the server HTML, then show the 3D model without first showing the photos as the main view.
- WHEN a shopper in `control`, or not in the experiment, opens a product page THE SITE SHALL render today's photos-first page.
- WHEN a shopper with no PostHog cookie opens a product page in the experiment THE SITE SHALL bootstrap PostHog with the same ID the server evaluated the flag for, as both the distinct ID and the device ID.
- WHEN a shopper signs in THE SITE SHALL keep showing them the same version.
- WHEN the flag can't be read within 1500 ms, the product has no model, or the URL carries `?design=`, `?code=` or `?resume=` THE SITE SHALL show today's page and record no exposure.
- WHEN a visitor first loads an experiment product page THE SITE SHALL send `$feature_flag_called` for `product-3d-first-experiment` with the version it rendered, once per visitor and version, and again after sign-in.
- WHEN any product page responds THE SITE SHALL send `Cache-Control: private, no-store`.
- WHEN 3D can't load in `test` THE SITE SHALL show the photos with today's note and send `product_3d_failed`.

## Verification

- Run `npm run check` and `npm run build` and show the output.
- Show `curl` output for the server HTML and headers in each case in Step 5.
- Show Chrome screenshots at 1440 and 390 for both versions, and the first-paint frame from a performance trace for `test`.
- Show the `/flags` request and response from `curl` with the device ID.
- In PostHog, after launch: `$feature_flag_called` events per version, `$feature/product-3d-first-experiment` on `product_added_to_cart`, and the experiment URL with exposures counting.
- Estimated values: none. No new UI is designed; the loading state is plan 11's.

## Risks and open questions

- **The PostHog project is unread** until you authorize the MCP. Event shapes, traffic and the running time are unknown. With a young store's traffic, completed orders may take months to reach a result.
- **Completed orders depend on plan 13 shipping.** It's approved but not released, and `/thank-you` is untested with a real order.
- **Revenue counts members only** (guest `order_paid` can't be joined to a browser).
- **Visitors who block cookies** get a new ID on every product page view and inflate exposures slightly. **Visitors who block PostHog** still see their version but record no exposure, so they're simply not in the results.
- **Page weight and speed in `test`.** The 3D chunk (~247 KB gz) and the model (< 5 MB) download on every 3D-first visit, phones included, and the main photo starts dimmed. LCP may rise. PostHog's web vitals (already captured) can be compared by version.
- **No cache for product pages.** If Wix's CDN was caching product HTML, pages now render per request. They already read live stock, so this is probably no change, but it's unverified.
- **Cost.** One extra PostHog `/flags` request per product page view (PostHog bills flag requests past the free monthly allowance). No Wix AI credits. The release (Step 10) and the launch (Step 12) each wait for your OK.
- **Bootstrap override edge.** This happens with no cookie (or an unparseable one) while localStorage still holds PostHog state, for example cookies cleared and storage kept. The anonymous bootstrap ID then replaces both the stored distinct ID and `$device_id`, which has three effects:
  - the visitor's earlier anonymous history isn't joined;
  - they can switch versions;
  - if storage held a signed-in member, PostHog marks them anonymous until `member-store.ts` identifies them again on that page.

  This is rare, and it's how posthog-js treats an anonymous bootstrap.

## Result

Filled at close-out.
