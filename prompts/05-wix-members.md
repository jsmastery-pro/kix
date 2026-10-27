# 05 · Wix Members: real sign in, accounts and the header menu

Status: approved

<!-- review → approved → done, or dropped. Only the user approves. -->

**Request:** "Connect my project from this folder to wix business solutions using wix.com/headless/skill.md. Start with Wix Members for the sign in and create account pages we built, with email and password, Google, email verification and forgot password, plus an account menu in the header and a simple account page."

## Goal

Shoppers can create a real Kix account and sign in on the `/login` and `/create-account` pages from plan 04, with email and password or with Google. When Wix asks for an email code, the same card asks for it. A shopper who forgot their password asks for a reset link on `/forgot-password`, sets a new password on Wix's page, and comes back to sign in. The first and last name typed at signup are saved to the member's profile. Signed-in members see their initial (or photo) in the header. It opens a menu with their name, email, Account and Sign out. `/account` shows their profile, lets them change their name, emails them a password reset link and signs them out. Members live in Wix (dashboard → Contacts → Site Members).

## Out of scope

- Orders, saved designs or any other member data on `/account` (the store isn't wired yet).
- Facebook login, reCAPTCHA, a "resend code" action (the verify route can't send a new code; Wix's docs say to start over), remember me (plan 04), changing the login email.
- `/terms` and `/privacy` pages (still 404, as in plan 04).
- PostHog events (PostHog isn't set up).
- Releasing. The plan ends on a local build; releasing is a separate yes from the user.
- The storefront wiring (`CartButton`, categories).

## Decisions

- **Designs (user):** none exist for the header menu, `/account`, `/forgot-password` and the email-code step. They're built from the design system and the plan 04 surfaces (`AuthSplit`, `FormCard`, `TextField`, `Button`, `FormAlert`), specified under Approach.
- **Header control (user):** for a member, the person icon becomes a black circle with their initial (their photo when they have one). It opens a menu: name, email, Account, Sign out. Visitors keep the icon, which links to sign in.
- **Account page (user):** profile (name, email, member since), a form to change first and last name, a "Send reset link" button, and Sign out. No orders.
- **Kit code, deployed as-is:** `deploy.mjs members --stack astro` copies the kit's members data layer and auth seam into `src/wix/` and adds `@wix/members` (approving this plan approves that dependency). It only writes missing files, so our `login.astro`, `SiteLayout.astro` and `global.css` stay. The kit's React UI (`components/members/*.tsx`, `hooks/members/useMember.ts`) arrives too and stays unused, as the reference AGENTS.md describes. We use the framework-free `member-store.ts` from our Astro scripts, as plan 04 planned. The kit's `pages/account.astro` is new, so it's written; we replace its body with ours.
- **No React islands.** Every surface is Astro markup plus a bundled `<script>`, like plan 04. One `member-store` module instance is shared by every script on a page.
- **Who's signed in, on the server:** `/account`, `/login`, `/create-account` and `/forgot-password` call the kit's `fetchCurrentMember()` in their frontmatter (one Wix call per render, inside the 20 sub-request limit). On `/account` a visitor is redirected to `/login?returnTo=/account`. On the three auth pages a member is redirected to their `returnTo` (default `/account`). All four pages send `Cache-Control: private, no-store`, because their output depends on the session. We don't use the integration's `getContextualAuth().loggedIn()`: it's exported from `@wix/sdk-runtime`, which isn't a declared dependency, and the kit's rule is "never read the session yourself". This needs the Members Area app installed, because without it a signed-in member reads as `null` (see Risks).
- **One `returnTo` rule, now an origin check (review fix).** Plan 04's `safeReturnTo` (starts with `/`, not `//`) accepts `/\evil.com`, which browsers read as `//evil.com`. Plan 04 never redirected itself, but this plan does: `Astro.redirect`, `location.assign`, and the logout URL. So `safeReturnTo(value, origin)` becomes: `new URL(value, origin)`; reject unless `.origin === origin`; return `pathname + search + hash`. Every redirect, link and `returnToUrl` goes through it. The server passes `Astro.url.origin`; the browser passes `location.origin`. The logout action is `/api/auth/logout?returnToUrl=${encodeURIComponent(safePath)}`.
- **Header session read is client-side.** `SiteLayout` doesn't read the member on the server, so ordinary pages make no extra Wix call. The header script subscribes to `member-store` (one `getCurrentMember` call from the browser per page load). The icon looks the same for visitors and members while the read settles, so no one sees a wrong state. A click during loading goes to `/login`, which sends a member straight back (server redirect above).
- **Install the Members Area app:** the kit's members seed (`seed-members.mjs`) installs Wix's Members Area app and nothing else. It's the profile layer, and without it `getCurrentMember` returns nothing. `read-site.mjs` shows it isn't installed today. Approving this plan approves running it. No members are created.
- **Google:** `GET /api/auth/login?idp=google&returnToUrl=<returnTo>`, confirmed in `@wix/astro` 3.1.0's `routes/login.mjs` and the Wix guide. The control stays a `<button>` that the script enables (plan 04's no-JS rule) and that navigates with `location.assign`. On create account, Google first requires the terms box: unchecked shows the terms error and focuses the box. Google must be enabled in the site's login settings (You need to).
- **Email verification:** Wix decides when a code is needed (the site's signup settings, or an email that already belongs to a contact). Login or signup then answers `EMAIL_VERIFICATION_REQUIRED` and Wix emails a code. The card switches to a code step in place, specified under Approach. The kit's `verifyEmail(code)` posts it to `/api/auth/verify-email`; the pending state is an HttpOnly cookie that lasts 15 minutes. "Start over" returns to the form, so a new submit sends a new code.
- **Forgot password — the kit's playbook is wrong here.** It names `POST /api/auth/reset-password`, but `@wix/astro` 3.1.0 (the latest on npm) injects no such route, and Wix's Astro custom-login guide says "There is no built-in password-reset route… use the SDK's `sendPasswordResetEmail` from the browser". `sendPasswordResetEmail` calls IAM Recovery's Send Recovery Email. We call that endpoint through the kit's own seam, `wixFetch` from `src/wix/sdk.ts`: `POST /_api/iam/recovery/v1/send-email` with `{ email, redirect: { url, clientId } }`, copied from the method page. That avoids importing `@wix/sdk-runtime`. It lives in a new data-layer file, `src/wix/members/recovery.ts` (the kit says extend by adding a file, never by editing). `url` is `<origin>/login?reset=done` and `clientId` is `WIX_CLIENT_ID` from `astro:env/client` (declared public by `@wix/astro`). Both are passed in by the caller, so the data layer stays free of Astro imports.
- **Allowed redirect URIs.** Two kinds matter:
  - The OAuth redirect is `<origin>/api/auth/callback` (`prepareOAuth`). Every sign-in fails on an origin that's missing from the list.
  - The guide says the reset `redirect.url` must be on the list too.
  
  Step 3 reads the OAuth app's list. It confirms the callback for `http://localhost:4321`, the live origin and the preview origin. It adds whichever of those three callbacks are missing, plus `http://localhost:4321/login?reset=done` and `https://<live origin>/login?reset=done`. Approving the plan approves these additions only. If there's no API for it, it moves to You need to. If an exact URL with a query doesn't validate, the fallback is `/login` with no notice.
- **The reset page is Wix's.** Wix hosts the "set a new password" page. Its docs note that the Wix site connected to a headless project must be published for that page to show. Checked in step 8. If it's needed, it's a You need to item.
- **Reset copy never reveals whether an account exists, and never hides a setup failure (review fix).** Step 8 records Send Recovery Email's status for a known email and for an unknown one.
  - 2xx, and the exact unknown-email status, show the same confirmation: "If there's a Kix account for that email, a reset link is on its way. It works for 3 hours."
  - 429 shows "Too many requests. Try again later."
  - Any other 4xx or 5xx, or a network error, is `'failed'`. In DEV only, it also logs a console warning with the status (never the email). This catches an un-allowlisted `redirect.url` or a bad `clientId`, instead of claiming an email went out.
  
  The 3 hours and the 200-per-day cap come from the docs.
- **Saving names after signup.** The built-in signup takes email and password only (plan 04, and the guide: "doesn't support additional profile fields"). Before `register()`, the script stores `{ email, firstName, lastName }` in `sessionStorage` (`kix:pending-name`: this tab only, never logged or sent elsewhere). The key is cleared at once on any register result except SUCCESS, EMAIL_VERIFICATION_REQUIRED and OWNER_APPROVAL_REQUIRED, and on a rejected promise. It's also cleared by "Start over" and by any `login()` or Google click. That way a failed signup followed by signing in to another account can't rename that account (review fix).

  After the callback lands, the header script sees a member plus a pending name. It applies the name only when `member.loginEmail` matches the stored email (case-insensitive); otherwise it clears the key. Applying calls the new `updateMemberName()` in `src/wix/members/profile.ts`, which runs `members.updateMember(member.id, { contact: { firstName, lastName }, profile: { nickname: "First Last" } })` as the member. The nickname is set too because the kit's `displayName` prefers `nickname` over first and last, and Wix may set a nickname at signup; without it the menu would keep the old name (review fix). Wix's Velo reference for `updateMember`: "Only logged-in members can call this function without elevated permissions", so no `auth.elevate()` and no server route. The REST page lists the "Manage Members" scope, so if step 8 gets a 403, I stop and ask rather than add an elevated route. After a successful save, it clears the key and calls `refreshMember()`. If the save fails, the key stays and the next page load retries. The account page lets the member fix their name anyway. A tab closed before verification or approval finishes loses the pending name (they set it on `/account`).
- **Result → message mapping changes** (in `auth-form.ts`; the rest of plan 04's table stays):

  | Result | Page | Shown as |
  | --- | --- | --- |
  | `notConnected` | — | Removed with `mock-auth.ts` |
  | `EMAIL_VERIFICATION_REQUIRED` | both | The code step (replaces the info alert) |
  | `OWNER_APPROVAL_REQUIRED` | both, and the code step | Info alert: "Your account is waiting for approval. You can sign in once it's approved." |
  | `FAILURE` `unknown` | create account | Error alert: "We couldn't create your account. Check your details and try again." (Wix's guide: signup answers `unknown` for some invalid details, such as the password) |
  | `AUTH_SERVICE_ERROR`, `INTERNAL_ERROR` | create account | Error alert: "Something went wrong. Your account may already exist, so try signing in." plus a **Sign in** link (the guide: don't repeat signup) |
  | `ALREADY_LOGGED_IN` | both | Info alert: "You're already signed in." plus a **Continue** link to `returnTo` and a **Sign out** button (the logout form). The guide says to offer both, and the button breaks a loop if `/account` ever misreads the session |
  | `resetPassword` | sign in | Unchanged text; the **Forgot password** link now works |
  | `VERIFICATION_FAILED` | code step | Code field error: "That code didn't work. Check it, or start over to get a new one." (the guide: this can also mean the challenge expired) |
  | `VERIFICATION_STATE_EXPIRED` | code step | Error alert: "This code expired. Start over to get a new one." |
  | `EMAIL_VERIFICATION_REQUIRED` again | code step | Stay on the step, clear the field, field error: "Enter the new code from your email." |
  | Rejected promise | code step | Error alert: "We couldn't reach Kix. Check your connection and try again." |
  | Any other failure | code step | Error alert: "Something went wrong. Try again, or start over." |

- **`/login?reset=done`** shows an info alert above the form on load: "Password changed. Sign in with your new password."
- **Testing needs you for four handoffs (review fix).** Verification codes and reset links go to real email, so during step 8 I ask, in the question panel:
  1. for an address to test with (a `+kix` alias of yours, say);
  2. to paste the code when the site asks for one;
  3. to confirm the reset email arrived, click its link, and say where it landed;
  4. to complete Google's sign-in screen in the browser I'm driving.
  
  Meanwhile I capture the network log and the header state. The saved name is read back with the Members API (`wix-manage`), not from the dashboard. The test members stay in the dashboard for you to delete; I don't delete data.
- **DEV preview of the code step:** in `npm run dev` only (`import.meta.env.DEV`, stripped from the build), `?preview=verify` on `/login` and `/create-account` opens the code step without calling Wix, so its layout can be screenshotted at 1440 and 390 even when the site doesn't ask for codes.
- **Dev server port:** the OAuth app allows `http://localhost:4321` (kit). Wix CLI 1.2.2's `wix dev` exits 1 (AGENTS.md), so checks run on `npx astro dev --port 4321` with `.env.local` loaded. Port 4333 would break the auth callback.
- **Branch:** `feat/wix-members`, from `feat/auth-pages`. One commit per step.
- **Plan review:** a general-purpose agent checked this plan against the kit code, `@wix/astro`'s source and the Wix guide. It confirmed the result codes, `verifyEmail`, and the store's navigation on SUCCESS. All ten of its findings are applied (marked "review fix"):
  - the origin-checked `returnTo`;
  - pending-name scoping by email;
  - the nickname;
  - recovery status mapping;
  - callback URIs;
  - mapping holes and the ALREADY_LOGGED_IN sign out;
  - logout encoding;
  - the user handoffs in step 8;
  - real title sizes;
  - UTC dates and no-store on auth pages.

## Context

- Read: `AGENTS.md`, `prompts/04-sign-in-and-create-account.md`, `src/scripts/auth-form.ts`, `src/data/mock-auth.ts`, `src/pages/{login,create-account}.astro`, `src/layouts/SiteLayout.astro`, `src/components/AuthSplit.astro`, `src/components/ui/{FormCard,FormAlert,IconButton,Button,SiteNav}.astro`, `src/styles/{global,site}.css` (tokens and auth rules), `astro.config.mjs`, `package.json`.
- Versions (`npm ls`): astro 7.4.2, @wix/astro 3.1.0 (latest on npm), @wix/sdk 1.21.18, @wix/cli 1.2.2, react 18.3.1. Node 24.18.0 via nvm (the shell defaults to 22.12; prefix `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` for Wix commands).
- Skill: `wix-headless-kit` 1.35.0 (plugin). `context.mjs` says shape `wix-project`, publisher `cli`, so we iterate: deploy, install, edit, never scaffold or reseed. Templates are at `~/.claude/plugins/cache/wix/wix/1.35.0/skills/wix-headless-templates/`. I read `members/INSTRUCTIONS.md`, `members/seed/SEED.md`, `shared/CUSTOM_OPERATIONS.md`, `shared/app/wix/sdk.ts`, `members/app/wix/members/{auth,auth-core,member-store,client,members,members-core,types}.ts`, and `install/deploy.mjs` (copy with `force:false`, fill-only dependency patch).
- `read-site.mjs` (members): the Members Area app is not installed on site `86f0930e-…`.
- `@wix/astro` 3.1.0 source: `integration/index.mjs` injects login, signup, verify-email, logout, callback and logout-callback, with no reset route. `routes/login.mjs`: GET with `idp` google or facebook. `credentialsRoutes-*.mjs`: email, password, captcha tokens, `returnToUrl`, `failureUrl`. `session-*.mjs`: the OAuth redirect URI is `/api/auth/callback` and `returnToUrl` travels in an HttpOnly cookie. The verification cookie lasts 900s.
- Docs:
  - https://dev.wix.com/docs/go-headless/authentication/members/custom-login-page/add-custom-login-with-the-astro-integration.md (outcomes table, verification, social login, password recovery, logout, allowed redirect URIs)
  - https://dev.wix.com/docs/api-reference/business-management/headless/recovery/send-recovery-email.md (path, body, the "publish the site" note)
  - https://dev.wix.com/docs/api-reference/crm/members-contacts/members/member-management/members/update-member.md
  - https://dev.wix.com/docs/velo/apis/wix-members-v2/members/update-member.md (members may update themselves without elevation)
- Builds on plan 04 (forms, `auth-form.ts`, the `returnTo` rule, the result mapping) and plan 03 (`SiteLayout`, header).

## Approach

### Data flow

```
login / create-account (SSR: fetchCurrentMember → member? redirect to returnTo)
  └─ auth-form.ts ── member-store.login/register/verifyEmail ── kit auth.ts ── POST /api/auth/{login,signup,verify-email}
        │                 SUCCESS → store navigates to redirectUrl → Wix → /api/auth/callback (writes session) → returnTo
        ├─ register: pending-profile.save({first,last}) → sessionStorage
        └─ Google: location.assign('/api/auth/login?idp=google&returnToUrl=…')

forgot-password ── forgot-password.ts ── wix/members/recovery.ts ── wixFetch POST /_api/iam/recovery/v1/send-email
                                                  redirect.url = <origin>/login?reset=done

every page: SiteLayout → AccountMenu ── account-menu.ts ── member-store.subscribeMember → getCurrentMember (browser)
                                             └─ pending name? → wix/members/profile.updateMemberName → refreshMember

account (SSR: fetchCurrentMember → visitor? redirect /login?returnTo=/account)
  └─ account.ts ── profile.updateMemberName (name form) · recovery.sendPasswordReset (password card)
     Sign out = native <form method="post" action="/api/auth/logout?returnToUrl=/">
```

Ownership matches AGENTS.md: accounts are Wix Members through `@wix/astro`'s built-in routes and the kit's members data layer. We add no callback pages and no auth code of our own; our two data-layer files only add calls the kit doesn't cover.

### New and changed code

- **`src/wix/members/profile.ts` (new):** `updateMemberName(memberId, { firstName, lastName }): Promise<CurrentMember>` calls `membersApi.updateMember` and maps the result through the kit's `toCurrentMember` with `imgSrc` (same imports as `members.ts`). It throws on failure; callers render the error.
- **`src/wix/members/recovery.ts` (new):** `sendPasswordReset(email, redirect?: { url; clientId })`. It runs `wixFetch('/_api/iam/recovery/v1/send-email', { method: 'POST', headers: JSON, body })` and resolves to `'sent' | 'rate-limited' | 'failed'`, using the mapping under Decisions (the unknown-email status is recorded in step 8).
- **`src/scripts/pending-profile.ts` (new):** `savePendingName(name)`, `applyPendingName(member)`. Storage calls are wrapped in try/catch.
- **`src/scripts/auth-form.ts` (change):**
  - Imports: `login, register, verifyEmail` from `../wix/members/member-store` and `type LoginResult` from `../wix/members/auth`.
  - Delete `src/data/mock-auth.ts`.
  - The mapping above; Google navigation; the code step; the `?reset=done` notice; the DEV `?preview=verify`.
  - `register` calls `savePendingName` just before submitting.
- **`src/scripts/forgot-password.ts`, `src/scripts/account.ts`, `src/scripts/account-menu.ts` (new):** these reuse `auth-form.ts`'s exported helpers (validation rules, `showAlert`, busy state). The shared bits are factored into exports, not duplicated.

### Surfaces (design system; values are tokens or `site.css` layout sizes)

**Header account control: `src/components/AccountMenu.astro` + `src/scripts/account-menu.ts`**

- SSR renders:
  - the visitor link: `IconButton href="/login?returnTo=<current path>" label="Sign in" shape="plain"` with `UserRound`. On `/login`, `/create-account` and `/forgot-password` it's plain `/login`.
  - a hidden member button: `<button aria-expanded="false" aria-controls="account-menu-panel">` labelled "Account menu".
  - a hidden panel.
- When the store reports a member, the script hides the link and shows the button. For a visitor, or while loading, nothing changes.
- **Avatar (new primitive `src/components/ui/Avatar.astro` plus a script-side render):**
  - The circle is 36px (`sm`) or 72px (`lg`), `--radius-pill`, `--color-black` background.
  - The initial is `--color-white`, `--font-display` 600, uppercase, 18px (`sm`) or 36px (`lg`). The initial is the first letter of `displayName`.
  - With a photo, `<img>` covers the circle (`alt=""`; the button carries the label).
  - The 36px circle sits in a 44px tap target.
- **Panel:**
  - Box: absolutely placed under the button, right edge aligned, `width: min(280px, 100vw - 32px)`. `--color-white` background, 1px `--color-border`, `--radius-lg`, shadow from the new token `--shadow-menu`, padding `--ds-space-4`.
  - Name line: `--font-display` 600, 20px, `--color-black`, one line with ellipsis.
  - Email line: `--font-sans` 14px, `--color-text-secondary`, ellipsis. Both lines come from the store's `CurrentMember`.
  - Then a 1px `--color-border` rule.
  - Then two rows, each at least 44px, `--font-display` 500 18px, `--color-black`, hover `--color-muted-fill` with `--radius-sm`:
    - **Account** (`<a href="/account">`);
    - **Sign out** (a `<button type="submit">` in `<form method="post" action="/api/auth/logout?returnToUrl=<path>">`, where `<path>` is the current page, or `/` on `/account`).
- **Behavior** (disclosure pattern, not an ARIA menu):
  - Click toggles `aria-expanded`.
  - Escape closes it and returns focus to the button.
  - A click outside, or focus leaving the panel, closes it.
  - Opening doesn't move focus; Tab enters the panel.
- **Phone:** same control and panel. The panel's right edge stays inside the 16px gutter.
- **Pending name:** after the member resolves, the script runs `applyPendingName`.

**Code step (both auth pages, inside the same `FormCard`)**

- A second `<form data-auth-verify hidden>` after the main form.
- On `EMAIL_VERIFICATION_REQUIRED`:
  - the main form hides;
  - the card's `h1` text becomes "Check your email" and gets focus (`tabindex="-1"`);
  - the verify form shows.
- Contents, top to bottom:
  - Text: "We sent a code to **{email}**. Enter it to finish." `--font-display` 400 20px, `--color-ink-soft`.
  - `TextField id="verify-code" label="Verification code" labelVisible size="lg" autocomplete="one-time-code" required maxlength={12} errors`. Empty submit shows "Enter the code from your email."
  - `FormAlert`.
  - `Button type="submit" size="form" label="Verify" busyLabel="Verifying…"`.
  - Then a centered line in the `.auth-form__switch` style: "Didn't get a code? **Start over**". Start over is a button styled as the switch link. It restores the title and the main form, keeps the typed email and names, clears the password fields, and focuses the email field.
- Spacing reuses the `.auth-form` rhythm (24px between groups, 28px above the submit).
- Phone: same as the plan 04 card.

**`/forgot-password` (`src/pages/forgot-password.astro`)**

- `AuthSplit` with the sign-in panel: same headline, subhead and photo as `/login`.
- `FormCard title="Reset password"`:
  - Intro: "Enter your account email and we'll send you a link to set a new password." (code-step text style).
  - `TextField id="reset-email" label="Email" labelVisible type="email" autocomplete="email" size="lg" errors` (plan 04's email rules).
  - `FormAlert`.
  - `Button type="submit" size="form" label="Send reset link" busyLabel="Sending…" disabled` (enabled by the script).
  - "Remembered it? **Sign in**" switch line, carrying `returnTo`.
- On `'sent'`:
  - the form fields hide;
  - an info alert shows: "If there's a Kix account for {email}, a reset link is on its way. It works for 3 hours.";
  - the switch line stays.
- `'rate-limited'` and `'failed'` show error alerts ("Too many requests. Try again later." / "We couldn't reach Kix. Check your connection and try again.").
- The sign-in page's "Forgot password?" link and the `resetPassword` alert link here, carrying `returnTo`.

**`/account` (`src/pages/account.astro` + `src/scripts/account.ts`)**

- SSR:
  - visitor → `Astro.redirect('/login?returnTo=/account')`;
  - member → render, with `Cache-Control: private, no-store`.
- Layout: `--color-panel` page. The content column is `width: min(1080px, 100% - 2 * var(--site-inset))`, centered, with `padding-block: clamp(40px, 5vw, 80px)`.
- **Heading row:**
  - `Avatar size="lg"`, then `h1` "Account" (the `.ui-form-card__title` rule: `--font-display` 700, `clamp(40px, 3.2vw, 46px)`, uppercase, line-height 1);
  - under it, "Member since {Month YYYY}" (`--font-sans` 16px, `--color-text-secondary`; omitted when `memberSince` is empty). It's formatted with `Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })`, so the 1st of a month doesn't show as the month before;
  - "Sign out" (`Button variant="secondary"` in the logout form, `returnToUrl=/`) right-aligned on desktop.
- **Cards row:** two cards side by side on desktop (`1.4fr 1fr`, 24px gap). Each card is `FormCard` with the new `level={2}` prop: an `h2` with a `.ui-form-card__title--h2` modifier at `clamp(28px, 2.2vw, 32px)`.
  - **Profile:**
    - Email, read-only: label "Email" (`--font-display` 500 20px) and the value (`--font-sans` 18px, `--color-ink-soft`). Then 24px.
    - A name form: first and last `TextField size="lg" labelVisible` in the `.auth-form__names` grid, prefilled from `member.firstName` and `member.lastName`, with the register rules (required, trimmed, 50 max).
    - `FormAlert`, then `Button type="submit" size="form" label="Save changes" busyLabel="Saving…"`.
    - Success: info alert "Saved." and the header menu name refreshes (`refreshMember()`). Failure: error alert "We couldn't save your name. Try again."
  - **Password:**
    - Text: "We'll email **{loginEmail}** a link to set a new password. It works for 3 hours."
    - `FormAlert`, then `Button variant="secondary" size="form" label="Send reset link" busyLabel="Sending…"`.
    - Results map as on `/forgot-password`; `'sent'` shows "Check your email for the link."
- Phone (below 768px):
  - the heading row stacks: avatar + h1 on one row, member-since under it, Sign out full-width below;
  - the cards stack;
  - the titles sit at their clamp minimums (40px and 28px), card padding 24px (FormCard's existing minimum);
  - tap targets stay at least 44px.
- A late pending-name save on this page updates the name inputs if the member hasn't typed in them yet (the script subscribes to the store).

### Pages changed

- `login.astro`:
  - SSR member redirect;
  - the Google button keeps `data-google` and gains `data-href` with the built link;
  - the verify form;
  - the `?reset=done` notice;
  - "Forgot password?" carries `returnTo`;
  - the header comment updated.
- `create-account.astro`: same, without the reset notice and the forgot link.
- `SiteLayout.astro`: the account `IconButton` is replaced by `<AccountMenu />`. Its header comment drops the "members wiring" note.

### Tokens

- **Reused:**
  - colors: `--color-black`, `--color-white`, `--color-panel`, `--color-border`, `--color-muted-fill`, `--color-text-secondary`, `--color-ink-soft`;
  - radii: `--radius-pill`, `--radius-sm`, `--radius-lg`;
  - fonts and spacing: `--font-display`, `--font-sans`, `--ds-space-4`;
  - `--ds-panel-shadow` on cards.
- **Proposed new:**

| Token | Value | Used for |
| --- | --- | --- |
| `--shadow-menu` | `0 12px 32px rgb(17 17 17 / 12%)` | The account menu panel (`--ds-panel-shadow` at 3% doesn't separate a popover from the page) |

Avatar sizes live with the primitive in `global.css`. Account layout sizes live in `site.css` as `--account-*`.

### Secrets, events, dependencies, data

- Dependency: `@wix/members` (added by the kit's deploy, at the kit's range `^1.0.511`).
- Wix site changes:
  - install the Members Area app (seed);
  - add two allowed redirect URIs (step 3).
- Secrets: none new. `WIX_CLIENT_ID` is public by design.
- Events: none (no PostHog yet).
- Member data: written only by members themselves (signup, name edits).

## Steps

- [x] 1. Branch `feat/wix-members`. Run `deploy.mjs members --stack astro`, then one `install.mjs` (Node 24.18) (check: `git status` lists only new kit files, `src/pages/account.astro`, and `package.json`/`package-lock.json` with `@wix/members` added; `npm run check` passes).
- [x] 2. Run the members seed: install the Members Area app (check: `read-site.mjs` reports `installed: true`).
- [x] 3. Allowed redirect URIs: look up the OAuth app API with `wix-docs` and read the app's allowed URIs. Confirm `/api/auth/callback` for localhost:4321, the live origin and the preview origin, adding any that are missing. Add the two `/login?reset=done` URLs if missing (check: read-back lists them all; if there's no API, it's recorded in You need to).
  - Result (2026-10-27): `allowedRedirectUris` already holds `/api/auth/callback` and `/api/auth/logout-callback` for `http://localhost:4321`, `https://my-site-1-sujata03-0908.wix-site-host.com` and the preview wildcard `https://*-my-site-1-sujata03-0908.wix-site-host.com`. `allowedRedirectDomains` (redirects "after processes other than authentication") already lists localhost:4321 and both live and preview origins. Nothing was written. The two `/login?reset=done` URIs are added in step 8 only if Send Recovery Email rejects the redirect.
- [x] 4. Token and primitives: `--shadow-menu`, `Avatar`, `FormCard level`, with Avatar and `level={2}` specimens on `/design-system` (check: `npm run check`; `/` and the existing `/design-system` sections look the same before and after in screenshots).
- [x] 5. Data layer and scripts: `profile.ts`, `recovery.ts`, `pending-profile.ts`, `auth-form.ts` changes; delete `mock-auth.ts` (check: `npm run check`; `grep -r mock-auth src` is empty).
- [x] 6. Pages: `login`, `create-account`, `forgot-password`, `account`, plus `site.css` rules (check: `npm run check`, `npm run build`).
- [x] 7. Header: `AccountMenu` in `SiteLayout` (check: `npm run check`, `npm run build`).
- [x] 8. Live checks against Wix on `localhost:4321`, with a test address from the user. Each check gets screenshots and network evidence:
  - sign up;
  - the name is saved (dashboard and menu);
  - the menu;
  - sign out;
  - sign in;
  - wrong password;
  - existing email;
  - Google;
  - forgot password (the email arrives, the reset page loads, the return lands on `?reset=done`; record the unknown-email status);
  - the code step (real, if the site asks; otherwise the DEV preview plus a note);
  - the account name edit;
  - the account reset link;
  - redirects (`/account` as a visitor; `/login` as a member).
- [x] 9. Visual pass at 1440 and 390: header (visitor, member, menu open), `/account`, `/forgot-password` (form and sent), code step on both pages. Also regression screenshots of `/login` and `/create-account` against plan 04's final shots. List differences, fix, repeat.
- [ ] 10. Reviewer subagent compares the work with this plan; fix real gaps. Then close out.

## Files

- **Create:**
  - `src/wix/members/profile.ts`, `src/wix/members/recovery.ts`;
  - `src/scripts/pending-profile.ts`, `src/scripts/forgot-password.ts`, `src/scripts/account.ts`, `src/scripts/account-menu.ts`;
  - `src/components/AccountMenu.astro`, `src/components/ui/Avatar.astro`;
  - `src/pages/forgot-password.astro`.
- **Kit (deploy, unchanged):**
  - `src/wix/{sdk,config,media,money}.ts`, `src/wix/members/*`;
  - `src/hooks/members/useMember.ts`, `src/components/members/*`.
- **Kit then replaced:** `src/pages/account.astro`.
- **Change:**
  - `src/scripts/auth-form.ts`;
  - `src/pages/login.astro`, `src/pages/create-account.astro`;
  - `src/layouts/SiteLayout.astro`;
  - `src/components/ui/FormCard.astro`;
  - `src/pages/design-system.astro`;
  - `src/styles/global.css`, `src/styles/site.css`;
  - `package.json`, `package-lock.json`;
  - `prompts/README.md`.
- **Delete:** `src/data/mock-auth.ts`.

## Acceptance criteria

- WHEN a visitor submits valid new details on `/create-account` THE SITE SHALL create a Wix member, sign them in, land on `returnTo` (default `/account`), and save the typed first and last name to the member.
- WHEN Wix answers `EMAIL_VERIFICATION_REQUIRED` THE SITE SHALL show the code step in the same card, and a correct code SHALL finish sign in.
- WHEN a member submits correct credentials on `/login` THE SITE SHALL sign them in and land on `returnTo`.
- WHEN a visitor clicks Continue with Google THE SITE SHALL go to Google through `/api/auth/login?idp=google` and come back signed in to `returnTo`. On create account it SHALL require the terms box first.
- WHEN a visitor submits an email on `/forgot-password` THE SITE SHALL show the same confirmation whether or not the account exists, and Wix SHALL email a reset link to an existing member.
- WHEN a member is signed in THE SITE SHALL show their initial or photo in the header on every page, with a menu holding their name, email, Account and Sign out.
- WHEN a visitor opens `/account` THE SITE SHALL redirect to `/login?returnTo=/account`. WHEN a member opens `/login`, `/create-account` or `/forgot-password` THE SITE SHALL redirect them to `returnTo` or `/account`.
- WHEN a member saves a new name on `/account` THE SITE SHALL update it in Wix and in the header menu.
- WHEN a member signs out THE SITE SHALL end the session and return to the page they were on (`/` from `/account`).
- THE SITE SHALL never send what a shopper typed anywhere but Wix, and SHALL never show Wix's developer error text.

## Verification

- `npm run check` and `npm run build` output.
- `read-site.mjs` output showing the Members Area app installed, and the read-back of the allowed redirect URIs.
- Step 8 screenshots and network evidence for each flow. Each flow is checked with the Playwright MCP if connected, otherwise Claude in Chrome; network logs show the `/api/auth/*` and `send-email` statuses.
- Wix dashboard → Contacts → Site Members shows the test member with the typed name.
- Step 9 screenshot pairs at 1440 and 390, with the difference list.
- No designs exist for the new surfaces, so the comparison is against this plan's spec and the plan 04 pages.

## Risks and open questions

- **Server member read is all-or-nothing.** `fetchCurrentMember` returns `null` both for visitors and on any error (a Wix hiccup, or the Members Area app missing). A signed-in member is then sent from `/account` to `/login`. There, a submit answers `ALREADY_LOGGED_IN`, whose alert offers Continue and Sign out. This is `/account`'s error state. Step 2 installs the app; a reload recovers from a hiccup.
- **Allowed redirect URIs:** whether a URI with a query string matches exactly, and whether there's an API to edit the list, are both untested. Fallbacks are under Decisions.
- **Wix-hosted reset page** may need the connected Wix site published (docs note). It's checked in step 8.
- **Google must be enabled** in the site's login settings, and may not work on `localhost` if Google's consent setup restricts origins. If it fails locally, it's retested on a preview URL (`npm run preview`, no release).
- **Send Recovery Email for an unknown address:** the status isn't documented. Handled by treating every non-429 4xx as `'sent'`.
- **Kit/doc mismatch:** the kit playbook's `/api/auth/reset-password` doesn't exist. I'll offer to report it to Wix.
- No credits or money spent. Each reset email counts toward Wix's 200-per-day cap.

## Result

Filled at close-out.
