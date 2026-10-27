# 04 · Sign in and create account pages

Status: approved

<!-- review → approved → done, or dropped. Only the user approves. -->

**Request:** "Build the sign in and create account pages from the two attached designs using our design system components. Include field validation, loading and error states, the password visibility toggle and the Continue with Google button, and make both pages work on phones. Don't connect real sign in yet."

## Goal

Shoppers can open `/login` and `/create-account` and see finished pages laid out like the two designs: the site header, a photo panel with a headline on the left, and a white form card on the right. Phones get a stacked layout. The forms validate every field inline, show a loading state on submit, show error messages, toggle password visibility and offer Continue with Google. Nothing is sent to Wix yet: a placeholder adapter, shaped exactly like the Wix kit's member store, answers every submit. Wiring real sign in later means swapping one import and handling the states the plan lists under Risks.

## Out of scope

- Real sign in, sign up, Google login or password reset. No calls to `/api/auth/*`. No Wix Members seeding.
- The kit's members files (`src/wix/members/`, `useMember`, `MemberMenu`, `RequireAuth`). They come with the wiring plan.
- The email verification code step and the "awaiting approval" notice. Wix's signup policy decides when they appear, so they belong in the wiring plan.
- `/account`, `/forgot-password`, `/terms` and `/privacy` pages. Links point at those future routes and 404 until built, as on the home page.
- A logged-in header (avatar, log out). PostHog events.

## Decisions

- **Name fields (user):** First and last name stay as designed and required. Wix's built-in signup on `@wix/astro` 3.1.0 accepts only email and password (confirmed in `node_modules/@wix/astro/build/dependencies/astro-auth/backend-runtime/credentialsRoutes-*.mjs`, and the kit's `PROFILE_ON_SIGNUP` is false on managed Astro). The adapter's `register` already takes `{ firstName, lastName }` like the kit's store. The wiring plan must save them to the member profile after signup.
- **Remember me (user):** left out. The session cookie `@wix/astro` writes has no lifetime option we can set, so the checkbox would do nothing. Intentional difference from the sign-in design. The row keeps "Forgot password?" right-aligned under the password field.
- **Panel photos (user):** two new free Pexels photos, one per page. Each is portrait, light background, has clear space in the top-left for the black headline, and shows unbranded sneakers. Each is inspected at full size for logos or recognizable branded designs, saved as about 1200px-wide JPEGs under 250 KB in `public/images/auth/`, and credited in `public/images/auth/SOURCES.md`. If no photo passes, that panel gets the sand tile with a marked "Image placeholder" (the `Photo` fallback).
- **Google mark (user):** Google's official multicolor "G" logo, stored as `public/images/brand/google-g.svg` and shown only on the Continue with Google button, as Google's sign-in branding guidelines require. It's an image asset, so its colors don't become tokens. At close-out, AGENTS.md's brand rule gets a line naming this exception.
- **Routes:** sign in is `/login`, the route the kit's `RequireAuth` and `LoginForm` use. The kit's deploy never overwrites existing files, so ours survives the wiring deploy. Create account is `/create-account`. Both read `?returnTo=` (a same-site path only, the kit's rule: starts with `/`, not `//`) and carry it across the cross-links. The default is `/account`.
- **Header account icon** points to `/login` until the wiring plan adds the kit's member control. Today `/account` 404s and no one can be signed in.
- **Cross-links (added, not in the designs):** under the Google button, "New to Kix? **Create account**" on sign in and "Already have an account? **Sign in**" on create account. Without them neither page can reach the other.
- **Create account copy:** the design's subhead promises "save your favorites", but Kix has no wishlist. The subhead becomes "Create an account to track orders, save your designs, and get early access to new releases." Saved designs are a planned feature (AGENTS.md), and early access is the member perk the user confirmed in plan 03. Sign in keeps "Same passion. A more personal experience."
- **What a submit does now:** the page script validates and then calls `src/data/mock-auth.ts`. Its `login(email, password, options)` and `register(email, password, profile, options)` match the kit's `member-store.ts` signatures and resolve to the kit's `LoginResult` shape after about 900 ms. Any email that isn't a reserved scenario address resolves to `FAILURE` with `errorCode: "notConnected"`, in dev and live alike. The page renders it as a neutral notice: "Accounts open soon. Nothing was sent or saved." In `npm run dev` only (`import.meta.env.DEV`, so the branch and the addresses are stripped from the build), reserved `example.com` addresses exercise every other branch:

  | Email | Result |
  | --- | --- |
  | `wrong@example.com` (sign in) | `FAILURE`, `invalidPassword` |
  | `reset@example.com` (sign in) | `FAILURE`, `resetPassword` |
  | `taken@example.com` (create account) | `FAILURE`, `emailAlreadyExists` |
  | `bad@example.com` (create account) | `FAILURE`, `invalidEmail` |
  | `captcha@example.com` | `FAILURE`, `captchaRequired` |
  | `verify@example.com` | `EMAIL_VERIFICATION_REQUIRED` |
  | `pending@example.com` | `OWNER_APPROVAL_REQUIRED` |
  | `offline@example.com` | the promise rejects |

  Neither the live notice nor the DEV scenarios log, store or send what the shopper typed.
- **Result → message mapping** (in `auth-form.ts`). The page always shows its own copy, never the kit's `error` text, which is written for developers ("…update @wix/astro to 2.75…").

  | Result | Page | Shown as |
  | --- | --- | --- |
  | `notConnected` | both | Info alert: "Accounts open soon. Nothing was sent or saved." |
  | `invalidPassword`, `invalidCredentials`, `invalidEmail` | sign in | Error alert: "That email and password don't match." The page never reveals which accounts exist. |
  | `resetPassword` | sign in | Error alert: "Reset your password to sign in." plus a **Forgot password** link |
  | `emailAlreadyExists` | create account | Email field error: "An account with this email already exists." plus a **Sign in** link (carrying `returnTo`) |
  | `invalidEmail` | create account | Email field error: "Use a different email address." |
  | `invalidPassword` | create account | Password field error: "Choose a stronger password." |
  | `captchaRequired`, `missingCaptchaToken`, `invalidCaptchaToken` | both | Error alert: "We couldn't verify this request. Try again later." |
  | `ALREADY_LOGGED_IN` | both | Info alert: "You're already signed in." plus a link to `returnTo` |
  | Rejected promise | both | Error alert: "We couldn't reach Kix. Check your connection and try again." |
  | Any other `FAILURE` (`unknown`, `authRoutesMissing`, `AUTH_SERVICE_ERROR`, `undefined`, …) | both | Error alert: "Something went wrong. Try again." |
  | `EMAIL_VERIFICATION_REQUIRED` | both | Info alert: "Check your email to finish creating your account." |
  | `OWNER_APPROVAL_REQUIRED` | both | Info alert: "Your account is awaiting approval." |
  | `SUCCESS` with `redirectUrl` | both | Nothing new: the form stays busy and is never re-enabled while the browser navigates. |
  | `SUCCESS` without `redirectUrl` | both | `location.assign(returnTo)`, form stays busy. |
- **Validation rules and copy:**

  | Field | Rule | Message |
  | --- | --- | --- |
  | Email (both) | required | "Enter your email address." |
  | Email (both) | valid format (`input.validity.typeMismatch`) | "Enter a valid email address, like name@example.com." |
  | Password (sign in) | required | "Enter your password." |
  | First name | required, trimmed | "Enter your first name." |
  | Last name | required, trimmed | "Enter your last name." |
  | Password (create) | at least 8 characters | "Use at least 8 characters." |
  | Confirm password | required | "Confirm your password." |
  | Confirm password | equals password | "Passwords don't match." |
  | Terms checkbox | checked | "Agree to the Terms of Service and Privacy Policy to continue." |

  Fields validate on blur once the shopper has typed in them, re-validate on every input once they show an error, and all validate on submit. Changing the password re-validates the confirm field if it has been typed in. A failed submit moves focus to the first invalid field. Wix's own password rule isn't documented in the docs search, so 8 is our minimum, to confirm during wiring. Wix's server-side email and password checks are still mapped (table above).
- **No-JS:** the submit and Google buttons render `disabled` and the script enables them, as `NewsletterForm` does. Without JavaScript nothing can post a password anywhere. The forms are `method="post"` with no `action`, so a password can never land in a URL.
- **Password toggle:** an eye button inside each password field (two on create account, each independent). It has a fixed `aria-label="Show password"` and toggles `aria-pressed` (`false` while hidden, `true` while visible). Changing the label too would announce "Hide password, pressed", which contradicts itself. Hidden shows `Eye`; visible shows `EyeOff`. The create-account design shows `EyeOff` while hidden; we use one convention on both pages (intentional difference). Toggling keeps the caret and value. Submitting resets both fields to hidden.
- **Labels:** sign in has visible labels ("Email", "Password"), as designed. Create account is placeholder-only in the design, so its labels are visually hidden (`sr-only`) and the placeholders stay. Every field has a real `<label>`.
- **Placeholder color** stays `--color-text-secondary` (4.8:1). The design's lighter gray (about `#9ca3af`, 2.5:1) fails contrast. Intentional difference.
- **Terms and Privacy links** open in a new tab (`target="_blank" rel="noopener"`) so the half-filled form isn't lost, each with a visually hidden " (opens in a new tab)". Routes `/terms` and `/privacy`.
- **Forgot password** links to `/forgot-password`. When wired, that page posts to `/api/auth/reset-password`, as the kit's playbook says.
- **Continue with Google** is a `<button type="button">` today. Clicking it shows "Google sign-in opens soon." in the form's visible `FormAlert` (info tone) and goes nowhere. When wired, it becomes `<a href="/api/auth/login?idp=google&returnToUrl=…">` (the kit's playbook), after the owner enables Google in the dashboard.
- **Phone layout (derived):** described under Approach. The photo is hidden below 768px, so the form is on the first screen.
- **One card spec for both pages.** The two designs differ by a few pixels (fields 57 vs 62px, buttons 66 vs 75px, card 509 vs 532px) because they're separate images. Both pages share one set of sizes, listed under Approach.
- **Panel photo loading:** the photo keeps `Photo`'s default `loading="lazy"`. An image in the first viewport still loads right after layout, so desktop costs little. Phones, where the panel photo is `display: none`, never download it. No new `Photo` prop.
- **Busy state keeps focus:** while a submit is in flight, inputs become `readonly` and the buttons get `aria-disabled="true"` (the script ignores clicks and submits), instead of a disabled `<fieldset>`. That way focus stays on the submit button rather than dropping to `<body>`. Every outcome then moves focus to whatever it shows: the alert (`tabindex="-1"`) or the invalid field. Links stay usable.
- **Plan review:** a general-purpose agent reviewed this plan (no `plan-reviewer` agent is defined). All 15 findings are applied:
  - the footer flex fix for the `TextField` wrapper;
  - the busy and disabled button looks, and focus kept during busy;
  - one place for the Google notice;
  - the full result-to-message mapping;
  - testable verification states and the `returnTo` check;
  - the `form` button size;
  - where `AuthSplit`'s colors live;
  - the two-import swap and the toggle labelling;
  - the confirm-field rules and repeat announcements;
  - SUCCESS staying busy, photo loading, `Button` `attrs`, and the new-tab cue.
- **No React island.** The forms are Astro markup with a bundled `<script>`, like `Carousel` and `NewsletterForm`. They render without hydration and work from the first paint. The kit's `member-store.ts` is framework-free ("every other stack uses it directly"), so the wiring plan imports it into the same script.

## Context

- Read: `AGENTS.md`, `prompts/03-home-page.md`, `prompts/02-design-system.md`, `src/styles/global.css`, `src/styles/site.css`, `src/layouts/SiteLayout.astro`, `src/components/ui/{TextField,Button,IconButton,Photo,NewsletterForm,Wordmark,SiteNav}.astro`, the password specimen in `src/pages/design-system.astro`, `astro.config.mjs`, `package.json`.
- Versions (`npm ls`): astro 7.4.2, @wix/astro 3.1.0, @lucide/astro 1.61.0, react 18.3.1, tailwindcss 4.3.3. Lucide icons confirmed present: `Eye`, `EyeOff`, `Check`, `LoaderCircle`, `CircleAlert`.
- Skill loaded: `wix-headless-kit`. Read the members playbook `node_modules/@wix/agent-skills/skills/wix-headless-templates/members/INSTRUCTIONS.md`, plus `app/components/members/LoginForm.tsx`, `app/wix/members/{auth-core,auth,member-store,types}.ts` and `app-astro/pages/login.astro`. Key facts: the login surface is `/login`; signup takes credentials only on managed Astro; `LoginResult` is `{ state: "SUCCESS" | "EMAIL_VERIFICATION_REQUIRED" | "OWNER_APPROVAL_REQUIRED" | "FAILURE", stateToken?, errorCode?, error?, redirectUrl? }`; Google is a plain link to `/api/auth/login?idp=google&returnToUrl=…`; forgot password is a POST form to `/api/auth/reset-password`.
- `@wix/astro` 3.1.0 source: `credentialsRoutes-*.mjs` (signup body is `email`, `password`, captcha tokens, `returnToUrl`, `failureUrl`), `saveSessionTokensToCookie-*.mjs` (no `maxAge` outside dev, so no remember-me).
- `wix-docs` search for Wix's member password rules returned nothing specific.
- Design images: both 1448 × 1086, so 1 design pixel ≈ 1 CSS pixel at 1440 (×0.994). All sizes below are measured from the images and are estimates.
- Builds on plan 03 (`SiteLayout`, `Photo`, tokens, Barlow Condensed, Pexels vetting).

## Approach

### Data flow

```
login.astro / create-account.astro  (SSR markup, no data)
  └─ <script> imports src/scripts/auth-form.ts
        validate → setBusy → mock-auth.login/register → render LoginResult
                                └─ wiring plan: import { login, register } from '../wix/members/member-store'
```

- `src/data/mock-auth.ts` exports `login`, `register`, and local `LoginResult` and `LoginOptions` types copied field for field from the kit's `auth-core.ts` and `auth.ts` (the kit's files aren't in the repo yet). A header comment names the swap: the functions come from `wix/members/member-store` and the types from `wix/members/auth` (the store doesn't re-export them). So wiring changes two import lines in `auth-form.ts`, not the markup.
- `src/scripts/auth-form.ts` holds the validation rules, the inline error rendering, the busy state, the `LoginResult` → message mapping, the password toggles and the `returnTo` rule. Both pages call `initAuthForm(form, { mode: 'login' | 'register' })`.
- Every result is rendered from the mapping table in Decisions. The wiring plan replaces the `EMAIL_VERIFICATION_REQUIRED` notice with the code step.
- `returnTo` is computed once per page load: `?returnTo=` if it starts with `/` and not `//`, otherwise `/account`. The cross-links and the "Sign in" link in the `emailAlreadyExists` message carry it.

### Components

Pages compose primitives; callers pass layout classes only.

- **Change `TextField`:** new optional props:
  - `labelVisible` (default `false`): a visible label above the field instead of the `sr-only` one.
  - `size: 'md' | 'lg'` (default `md`): `lg` is the auth field (below).
  - `minlength`, `maxlength`, `inputmode`, `value`.
  - `error` slot or id: renders `<p class="ui-field-error" id="{id}-error" hidden>` after the field, and the input gets `aria-describedby="{id}-error"`. The script sets `aria-invalid="true"` and unhides the message.
  - The wrapper becomes `<div class="ui-text-field">` holding the label, the existing `.ui-field` box and the error. `className` stays on `.ui-field`, as today. The wrapper becomes the flex child in the footer's newsletter row, so `global.css` gains `.ui-newsletter__row .ui-text-field { flex: 1; min-width: 0; }`. The `/design-system` and footer callers must render identically (checked by before/after screenshots).
- **New `PasswordField`:** a `TextField type="password" size="lg"` with a trailing toggle button (`Eye`/`EyeOff`, 44 × 44 tap target, icon 24px, `--color-text-secondary`). Props: `id`, `label`, `placeholder`, `autocomplete` (`current-password` / `new-password`), `labelVisible`, `minlength`.
- **New `Checkbox`:** a native `<input type="checkbox">` visually replaced by a 28px box (`--radius-xs`, `--color-control-border` border, white). Checked: `--color-black` fill with a white `Check` icon. Focus ring on the box. Invalid: `--color-error` border. The label is a slot (so it can hold the two links) and the whole row is at least 44px tall. Has its own error line like `TextField`.
- **New `Divider`:** a horizontal rule with centered text ("OR"): lines `--color-border`, text Barlow 500 18px `--color-text-secondary`, 24px gap each side. `role="separator"` is not used; the text is plain.
- **Change `Button`:**
  - `type?: 'button' | 'submit'` (default `button`).
  - `attrs?: Record<string, string>`, spread onto the element (as `IconButton` has), so scripts can hook `data-*` attributes.
  - New `size: 'form'`: the full-width form button. Height `clamp(54px, 4.9vw, 70px)` (designs 66 and 75px), `--radius-sm`, width 100%. With `variant="primary"`: Barlow 600, `clamp(20px, 1.67vw, 24px)`, uppercase, as both designs show. With `variant="secondary"`: Barlow 500, `clamp(18px, 1.53vw, 22px)`, normal case (the Google label). The rule lives in the primitive as a size × variant pair, so pages pass no type or color classes.
  - `busyLabel?: string`. When set, the button also renders a hidden `LoaderCircle` spinner. The script sets `aria-busy="true"` and `aria-disabled="true"` and swaps the label to `busyLabel`. `.ui-button[aria-busy="true"]` keeps the variant's colors (not the grey `:disabled` look) and shows the spinner. The spinner spins with `--ds-motion-spin` and stops under `prefers-reduced-motion` (the existing global rule), staying visible.
  - `.ui-button[aria-disabled="true"]` (the Google button while busy) gets `opacity: .6` and `cursor: default`.
  - `disabled` already exists. Without JavaScript, the submit and Google buttons render `disabled` and look grey: an honest "unavailable" look.
- **New `FormAlert`:** `<div class="ui-form-alert" role="alert" hidden>` with a `CircleAlert` icon and a message slot filled by the script. Variants by `data-tone`: `error` (`--color-error-surface` background, `--color-error` text and icon) and `info` (`--color-muted-fill` background, `--color-black` text) for "Accounts open soon" and the Google note. Messages can include one link (Sign in, Forgot password).
- **New `FormCard`:** the white card: `--color-white`, 1px `--color-border`, `--radius-lg`, `--ds-panel-shadow`, padding below; an `h1` title (Barlow 700 uppercase). Slot for the form.
- **New `GoogleMark`:** `<img src="/images/brand/google-g.svg" alt="" width="28" height="28">` for the Button's `leading` slot. The button text says "Continue with Google", so the image is decorative.
- **New composite `src/components/AuthSplit.astro`** (page section, like `SiteFooter`): the two-column section. Props: `headline: string[]` (one entry per line), `subhead: string[]`, `photo: { src, alt }`. Left: `Photo` filling the panel, with the headline and subhead on top of it. Right: a slot for the `FormCard`.
  - Heading order: the card title is the page's `h1` ("Sign in" / "Create account"). The panel headline is a decorative tagline rendered as `<p class="auth-split__headline">`, so the page has one `h1` and the form is the main subject.
  - Its colors and type (sand background, headline and subhead font, size, case and color) go in `global.css` as `.auth-split__*` rules, the way `SiteFooter`'s type rules do. `site.css` gets only its grid, paddings and sizes.
- **Change `SiteLayout`:** account icon `href="/account"` → `/login` (label stays "Account").
- **Pages:** `src/pages/login.astro`, `src/pages/create-account.astro`, each `SiteLayout` + `AuthSplit` + `FormCard` + the form markup + `<script>` calling `initAuthForm`.

Form markup, sign in (order):

1. `FormCard title="Sign in"`.
2. `<form method="post" data-auth-form="login">`. The script adds `novalidate` so its own messages replace the browser's.
3. `TextField id="login-email" label="Email" labelVisible type="email" autocomplete="email" required placeholder="Enter your email" size="lg"`.
4. `PasswordField id="login-password" label="Password" labelVisible autocomplete="current-password" placeholder="Enter your password"`.
5. Row, right-aligned: link "Forgot password?" → `/forgot-password`.
6. `FormAlert`.
7. `Button type="submit" label="Sign in" busyLabel="Signing in…" size="form"`.
8. `Divider` "OR".
9. `Button variant="secondary" size="form" label="Continue with Google" attrs={{ 'data-google': '' }}` with `GoogleMark`.
10. Cross-link line, centered: "New to Kix?" + link "Create account" → `/create-account` (+ `returnTo`).
11. A `<p class="sr-only" aria-live="polite" data-auth-status>` for busy announcements ("Signing in…").

Create account (order): title "Create account"; a two-column row with First name (`autocomplete="given-name"`, `maxlength="50"`) and Last name (`family-name`, 50); Email address (`email`); Password (`new-password`, `minlength="8"`, placeholder "Password"); Confirm password (`new-password`, placeholder "Confirm password"); `Checkbox` "I agree to the Terms of Service and Privacy Policy." (links underlined); `FormAlert`; submit "Create account" / busy "Creating account…"; Divider; Google button; cross-link "Already have an account? Sign in" → `/login`; status line. Labels are `sr-only` with the placeholders' text.

### States

| State | What the shopper sees |
| --- | --- |
| Idle | Fields empty; submit and Google enabled once the script runs (disabled without JS). |
| Field invalid | Field border and message in `--color-error`; `aria-invalid="true"`; message under the field (16px, Barlow 400); focus moves to the first invalid field on submit. |
| Submitting | Inputs `readonly`, checkbox and buttons `aria-disabled="true"` (focus stays on the submit button); submit shows the spinner and "Signing in…" / "Creating account…"; form `aria-busy="true"`; the status line announces it. A second submit is ignored. |
| Not connected (default) | `FormAlert` info tone: "Accounts open soon. Nothing was sent or saved." The form re-enables with values kept (passwords hidden again); focus moves to the alert. |
| Error | `FormAlert` error tone with the mapped message, or a field error (mapping table). Focus moves to the alert (`tabindex="-1"`) or to the field. |
| Google clicked | `FormAlert` info tone: "Google sign-in opens soon."; focus stays on the Google button. |
| Photo fails | The `Photo` fallback: sand tile with "Image placeholder". |

The alert clears when the shopper edits any field or submits again. To show a message, the script empties the alert and sets the text on the next animation frame, so a repeated message (a second Google click) is announced again, as `NewsletterForm` does.

### Desktop layout (1440, measured from the designs)

- **Header:** the existing site header (118px at 1440; the designs show about 120 and 91).
- **Section:** full width, `display: grid; grid-template-columns: 54.5fr 45.5fr` (design panel 787 / 1448 and 775 / 1448), `min-height: calc(100svh - var(--site-header-height))`. The panel touches the viewport's left edge. The footer follows below.
- **Panel:** background `--color-tile-sand` (design `#f1e7de`) behind the photo. The photo fills the panel (`object-fit: cover`, `object-position: center bottom`). Text block at `padding: clamp(40px, 6vw, 88px) var(--ds-space-6) 0 clamp(24px, 5.6vw, 84px)` (design 80–90 left, 84–99 top).
  - Headline: Barlow 700, `clamp(48px, 5.3vw, 76px)`, line-height 0.9, uppercase, `--color-black`, each entry of `headline` on its own line. Sign in: "Sneakers" / "Move culture" / "Forward". Create account: "Join a bigger" / "Sneaker culture".
  - Subhead: Barlow 400, `clamp(18px, 1.53vw, 22px)`, line-height 1.35, `--color-text-secondary`, 24px under the headline, max width 30em. Sign in: "Same passion." / "A more personal experience." Create account: the single line from Decisions (wraps at about 420px like the design).
- **Form column:** card centered both ways, `padding: clamp(48px, 5vw, 80px) var(--site-inset)`.
- **Card:** width `min(520px, 100%)`, padding 40px, `--radius-lg` (design ~12px), border 1px `--color-border` (design ~`#efefef`), shadow `--ds-panel-shadow`.
  - Title: Barlow 700, 52px, line-height 1, uppercase, 32px under it (design cap height 40px ≈ 52–54px type).
  - Visible label: Barlow 500, 20px, line-height 1.2, `--color-black`, 10px above the field.
  - Field `lg`: 60px high, `--radius-sm`, `--color-control-border`, horizontal padding 20px, text Barlow 400 20px. Focus: `--color-primary` border (existing). Invalid: `--color-error` border.
  - Field gap: 24px between field groups; the name row's columns are 18px apart.
  - "Forgot password?": Barlow 400, 18px, `--color-text-secondary`, underlined (offset 3px), 16px above, right-aligned; the link is at least 44px tall.
  - Checkbox row: 28px box, 14px gap, Barlow 400 18px `--color-ink-soft`; links `--color-black`, underlined. 24px above it.
  - Submit: `Button size="form"` (70px at 1440), 28px above.
  - Divider: 28px margin above and below.
  - Google: `Button variant="secondary" size="form"`, label Barlow 500 22px in normal case, 28px G mark, 24px gap.
  - Cross-link line: Barlow 400 18px `--color-text-secondary`, link `--color-black` 600 underlined, 24px above, centered.
  - Form alert: 16px padding, `--radius-sm`, Barlow 400 18px, 20px icon, 20px above the submit.

### Phone layout (390, derived)

- Header: the existing phone header.
- Section: one column. The panel becomes a band on `--color-tile-sand`, `padding: 32px 16px 28px`. The photo is hidden (`display: none`, so it doesn't download, since it's lazy). Headline 40px, line-height 0.92; subhead 17px.
- Form column: `padding: 24px 16px 48px`. The card stays (border and shadow) with 24px padding, full width.
- Title 40px. Fields 56px with 18px text (stays above 16px, so iOS doesn't zoom on focus). The name row stays two columns (each about 147px).
- Buttons: `form` is 54px at 390. Submit label 20px, Google label 18px.
- All tap targets are at least 44px: password toggles, the checkbox row, "Forgot password?", the cross-links. The two links inside the terms sentence are inline links (WCAG 2.5.8 exception).
- No horizontal page scroll.

### Tokens

**Existing tokens reused:** `--color-black`, `--color-white`, `--color-panel` (page, design `#fefcfb`), `--color-border`, `--color-control-border`, `--color-text-secondary`, `--color-ink-soft`, `--color-muted-fill`, `--color-primary` (focus), `--color-tile-sand` (panel), `--radius-xs`, `--radius-sm`, `--radius-lg`, `--ds-panel-shadow`, `--ds-motion-fast`, `--font-display`.

**Proposed new tokens:**

| Token | Value | Used for |
| --- | --- | --- |
| `--color-error` | `#b91c1c` | Error text, invalid borders, alert icon (6.5:1 on white) |
| `--color-error-surface` | `#fef2f2` | Error alert background |
| `--ds-motion-spin` | `800ms` | Button spinner rotation |

Layout sizes live in `site.css` as `--auth-*` custom properties (panel split, paddings, card width). Primitive sizes live with the primitives in `global.css`, as today.

### Secrets, events, dependencies, data

None. No new npm packages. Nothing is sent or stored.

## Steps

- [x] 1. Photos and Google mark: find two portrait Pexels photos with light backgrounds and top-left space, inspect each at full size for brand marks, save them to `public/images/auth/` (about 1200px wide, under 250 KB) with `SOURCES.md`. Save Google's official G as `public/images/brand/google-g.svg` with its source URL in `public/images/brand/SOURCES.md` (check: visual inspection of each photo, file sizes listed).
- [x] 2. Tokens and primitives: add the three tokens; change `TextField` and `Button`; add `PasswordField`, `Checkbox`, `Divider`, `FormAlert`, `FormCard`, `GoogleMark`; take a `/design-system` and `/` screenshot before and after (check: `npm run check`; the before/after screenshots of `/design-system` and `/` are identical).
- [x] 3. Logic: `src/data/mock-auth.ts` and `src/scripts/auth-form.ts` (check: `npm run check`).
- [x] 4. Pages: `AuthSplit`, `login.astro`, `create-account.astro`, `site.css` auth rules, header icon → `/login` (check: `npm run check`, `npm run build`).
- [x] 5. Visual pass: screenshots at 1440 and 390 of both pages, compared with the designs section by section; list differences, fix, repeat until only the documented intentional differences remain (check: final screenshot pairs plus the difference list).
- [ ] 6. Behavior checks in the browser (check: screenshots and console output for each):
  - Empty submit on each page shows every field error and focuses the first.
  - A bad email shows the format message on blur; fixing it clears the message while typing.
  - A 7-character password, an empty confirm and a mismatched confirm show their messages; changing the password re-checks a typed confirm; the unchecked terms box shows its message.
  - The password toggles switch type, icon and `aria-pressed` independently.
  - A valid submit shows the spinner and busy label, keeps focus on the button, then shows the not-connected notice with the values kept and focus on the alert.
  - Each scenario email in the Decisions table shows its mapped message, field or alert.
  - The Google button shows its notice, and a second click announces it again.
  - `/login?returnTo=/cart` puts `returnTo=%2Fcart` on the Create account link; `/login?returnTo=//evil.com` falls back to `/account`.
  - The production bundle has no scenario addresses: `grep -r "example.com" dist/` (or the build's client output folder) finds nothing.
  - Tab order follows the visual order; every control has a visible focus ring.
  - No horizontal overflow at 390 (`document.documentElement.scrollWidth === 390`) and every tap target is at least 44px.
  - Network panel: no request carries the typed email or password.
  - With JavaScript disabled, the buttons are disabled.
- [ ] 7. Review and close out: a reviewer subagent compares the work with this plan; fix real gaps; write Result, update the index, propose AGENTS.md edits (the Google mark exception, the member-auth placeholder line); commit each passing step.

## Files

- **Create:**
  - `prompts/04-sign-in-and-create-account.md`
  - `src/pages/login.astro`, `src/pages/create-account.astro`
  - `src/components/AuthSplit.astro`
  - `src/components/ui/{PasswordField,Checkbox,Divider,FormAlert,FormCard,GoogleMark}.astro`
  - `src/data/mock-auth.ts`
  - `src/scripts/auth-form.ts`
  - `public/images/auth/*.jpg`, `public/images/auth/SOURCES.md`
  - `public/images/brand/google-g.svg`, `public/images/brand/SOURCES.md`
- **Change:**
  - `src/components/ui/{TextField,Button}.astro`
  - `src/layouts/SiteLayout.astro` (account link)
  - `src/styles/global.css` (tokens, primitive styles)
  - `src/styles/site.css` (auth layout)
  - `prompts/README.md`

## Acceptance criteria

- WHEN `/login` or `/create-account` opens at 1440px, THE SITE SHALL show the header, the photo panel with the headline and subhead, and the form card in the design's proportions, colors and type, except for the documented intentional differences.
- WHEN either page opens at 390px, THE SITE SHALL show the headline band, then the full form, with no horizontal scroll and every tap target at least 44px.
- WHEN a shopper submits with empty or invalid fields, THE SITE SHALL show each field's message under it, mark it `aria-invalid`, send nothing, and focus the first invalid field.
- WHEN a shopper submits a valid form, THE SITE SHALL disable the form, show the spinner and busy label, then show "Accounts open soon. Nothing was sent or saved." with the values kept.
- WHEN the adapter returns a failure (DEV scenarios), THE SITE SHALL show the mapped message without revealing whether an email has an account (except `emailAlreadyExists` on create account, which Wix itself reports).
- WHEN a shopper presses a password toggle, THE SITE SHALL switch that field between hidden and visible and update its icon, label and `aria-pressed`.
- WHEN a shopper presses Continue with Google, THE SITE SHALL show "Google sign-in opens soon." and navigate nowhere.
- WHEN `mock-auth.ts` is replaced by the kit's `member-store.ts`, THE pages SHALL need no markup changes (same function signatures and `LoginResult` shape).
- THE pages SHALL never send, log or store a typed email, name or password.

## Verification

- `npm run check` and `npm run build` (Node 24.18): output shown.
- Local server: `npx astro dev --port 4333` (`wix dev` exits 1 on its dashboard step). Exact-viewport screenshots through the Chrome DevTools protocol at 1440 and 390 (device emulation for 390, scrolling first so lazy images load), placed beside the design images. Claude in Chrome for the interaction checks, because the Playwright MCP isn't connected.
- The not-connected notice is the same in dev and live (any non-scenario email), so it's checked in dev. The build output is grepped to prove the DEV scenarios are stripped.
- `/design-system` and `/` before/after screenshots for the `TextField` and `Button` changes.
- The report lists every difference from the designs, every estimated value, and each image source.
- No Wix records or PostHog events are involved.

## Risks and open questions

- Wiring (a later plan) has to: deploy the kit's members files; swap the import; save first and last name after signup (the built-in route drops them); build the verification-code and pending-approval states; switch the Google button to the `/api/auth/login?idp=google` link after the owner enables Google login; build `/forgot-password`; restore the header's account control. Wix's password policy may differ from our 8-character minimum.
- Stock photos won't match the designs' studio shoes on plinths. Finding a portrait, light, unbranded photo with headline space may take several tries; the marked placeholder covers a miss.
- All sizes are estimates from two images that disagree by a few pixels.
- The Google "G" is a real brand mark, used under Google's sign-in branding guidelines on that button only (user-approved exception to the brand rule).
- The `TextField` wrapper and the `Button` additions touch shared primitives; the before/after screenshots of `/` and `/design-system` guard them.
- No money, Wix AI credits, data changes or release. Release isn't part of this request; ask after verification if wanted.

## Result

Filled at close-out.
