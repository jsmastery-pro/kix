# Kix

3D sneaker store. Shoppers browse, spin every shoe in 3D, recolor its upper, sole, laces and accent, and buy the result with a design code on the order. Built on Wix-managed headless (Astro, hosted by Wix).

This file is the project's memory: it holds every decision that is still true. Plans in `prompts/` are history; `prompts/README.md` indexes them. Products, prices and stock live in Wix, never in files.

## Brand

- Kix is a made-up brand with a Nike-style look. The page designs show Nike's logo and product names as references only: use a Kix wordmark (a marked placeholder until a real asset exists) and our own product data. Never use real brands' names, logos or shoe designs. The one exception is Google's official G on the Continue with Google button (`public/images/brand/`), which Google's sign-in guidelines require.
- Look: warm off-white backgrounds, near-black type and buttons, a red primary, condensed uppercase headlines, product-first layouts on soft pastel tiles. Once the design system exists, its tokens are the source of truth.
- Voice: confident, short sentences, motion words. Never invent reviews, ratings, stock levels or delivery promises.

## Commands

Use Node.js 24.18.0 or newer for Wix CLI commands. The shell defaults to Node 22.12; prefix `PATH="$HOME/.nvm/versions/node/v24.18.0/bin:$PATH"` for Wix commands and the kit's scripts.

```bash
npm run dev                       # wix dev → Astro on http://localhost:4321; Wix CLI 1.2.2 currently exits 1 while preparing its dashboard
npm run check                     # astro check (types)
npm run build                     # wix build
npm run preview                   # wix preview → shareable preview URL (backends stop after 3 days)
npm run release                   # wix release → live site. Ask the user first
npm run wix env set -- --key K --value V   # then: npm run wix env pull
npm run generate                  # wix generate → dashboard pages, events, data collections
npx astro dev --port 4321 --background   # plain Astro dev server (one per project; stop: npx astro dev stop; logs: npx astro dev logs, restart if they go stale). Auth only works on 4321, the one local origin the OAuth app allows; stop any stale server holding it first
npm run release -- --version-type minor --comment "…"   # non-interactive release
```

All Wix CLI commands: `node_modules/@wix/cli/agents/instructions.md`.

## Docs first

Every tool here changes fast. Never assume a version. Read declared ranges in `package.json` and resolved versions in `package-lock.json` or `npm ls`, then read the docs for those versions before writing any Wix, Astro or PostHog code. When a Wix skill needs a newer version than the one installed, say so and plan the upgrade as its own step.

- **Wix:** Wix skills are installed in `node_modules/@wix/agent-skills/skills/`. Load the matching skill: `wix-headless-kit`, the Wix Headless skill (Wix's shipped store, members and CMS code, seeding, releases), `wix-app` (dashboard pages, backend events, data collections), `wix-design-system` (dashboard UI), `wix-manage` (site settings via API), `wix-docs` (any API lookup). Use the Wix MCP when connected; otherwise use the lookup flow in `wix-docs`. A prompt that points at `wix.com/headless/skill.md` means the same Wix Headless skill. In this folder it reuses the site in `wix.config.json`. Keep our pages and code, add only what the request needs, seed nothing without asking, and follow this file's workflow and rules.
- **Astro:** check the official docs for the installed major before writing Astro code; use the Astro Docs MCP (`astro-docs`) when connected.
- **PostHog:** when connected, use the PostHog plugin's skills (`posthog:instrument-product-analytics`, `posthog:instrument-error-tracking`, `posthog:instrument-feature-flags`, `posthog:building-a-dashboard`, `posthog:creating-experiments`) and the PostHog MCP. Docs: https://posthog.com/docs (Astro page; JS config for the current `defaults` value).
- **Browser:** use the Playwright MCP when connected; otherwise use available browser tooling to open pages and take screenshots.

## Who owns what

Each tool has one job. Ask before moving a responsibility to a different tool. Close-outs fill in details here.

The UI primitives, tokens and site layout (`src/layouts/SiteLayout.astro`, shaped like the kit's) exist. The kit's members and storefront data layers (`src/wix/sdk.ts`, `src/wix/members/`, `src/wix/storefront/`) are deployed. Wix Stores holds 12 placeholder Kix sneakers (USD, untracked stock, Color and Size options) in categories `men`, `women`, `kids`, `sports` (children `lifestyle`, `running`, `basketball`, `skate`, `training`) and the curated `new-arrivals` and `popular`. The home page reads Stores; `src/data/mock.ts` keeps only the home slides, member perks and header nav. `/shop` (Sports scope, so Wix's sample products stay off) and `/category/[slug]` are the explore page: the `ShopView` React island on the kit's `useShop` with our own filter UI (the kit's `FilterPanel` is unused), server-rendered from the URL's filters; invalid filter keys redirect to a clean URL. `/products/[slug]` is the product page: the `ProductView` island on the kit's `useProductDetail` with our own pickers (the kit's `OptionPicker` is unused); the sections below it render on the server. The header `BagButton` shows the live count from `useCart`; there is no cart drawer or page yet (`/cart` 404s). The kit's deploy never overwrites existing files, so the cart plan merges its `CartButton`/`CartDrawer` into `SiteLayout` by hand.

- **Hosting, deploys, secrets:** Wix (CLI). Secrets are declared in `astro.config.mjs` with `envField` and set with `wix env set`; read server secrets from `astro:env/server`.
- **UI:** our own primitives in `src/components/ui/`, built from the design system sheet. Pages compose them; callers pass layout classes only, and a caller needing a new color means a variant is missing. React islands use React twins of the primitives (`src/components/ui/*.tsx`, same classes as the Astro ones; keep them in step) and `lucide-react` icons.
- **Mock data:** until a page is wired to Wix, it reads `src/data/mock.ts`, shaped exactly like the storefront DTOs the `wix-headless-kit` skill ships (`storefront/app/wix/storefront/types.ts` in the templates it downloads), so wiring it is a swap, not a rewrite.
- **Catalog, cart, checkout, orders:** Wix Stores and Wix eCommerce (Wix's hosted checkout), through the data layer and hooks shipped by `wix-headless-kit` (`src/wix/storefront/`, `src/hooks/storefront/`). Don't rewrite that logic. Its UI components are used only where they match the designs, and they use theme tokens we don't define yet (`bg-foreground`, `text-muted-foreground`, `rounded-control`…): alias them in `global.css` before mounting one. Seed inputs and scripts live in git-ignored `.seed/`; their plan holds their content. One kit edit: `searchCatalog`'s count includes the search (`catalog.ts`, plan 08); a kit re-deploy drops it. Each sneaker has its own Features and Materials info sections (`<slug>-features`, `<slug>-materials`); the kit's seed shares sections by title, so new products need unique section names.
- **Other data (3D model links, saved designs):** Wix CMS collections, keyed by product ID as a text field. CMS can't reference Stores products.
- **Accounts:** Wix Members through `@wix/astro`'s built-in `/api/auth/*` routes and the kit's framework-free `member-store.ts`, used from Astro scripts (`src/scripts/auth-form.ts`, `account-menu.ts`); the kit's React members UI stays unused. No custom callback pages. `@wix/astro` has no reset route: forgot password calls Send Recovery Email (`src/wix/members/recovery.ts`). Signup takes email and password only, so names wait in `sessionStorage` and are saved with `updateMember` as the member (`profile.ts`). Pages read the member on the server with `fetchCurrentMember()` (needs the Members Area app, installed). The site's signup security requires reCAPTCHA, which our forms don't render, so email signup fails until it's added or switched off. No remember-me (the session cookie's lifetime can't be set).
- **3D models:** made by the user in Tripo Studio (the web app; no Tripo API or key) and downloaded as GLB into `models/raw/`. The agent optimizes them with glTF Transform into `models/web/`, stores them in Wix, and renders them with React Three Fiber islands (`client:only="react"`). Not set up yet.
- **Analytics, replay, flags, experiments:** PostHog through `track()` in `src/scripts/analytics.ts` and its typed catalog. `PostHog.astro` masks the search (`q`) in event URLs and referrers.
- **Styling:** tokens and primitive styles in `src/styles/global.css`; page layout in `src/styles/site.css` (sizes and grids only). Headlines use Barlow Condensed through Astro's Fonts API (`--font-barlow`), so builds need network access. Tailwind's preflight strips link underlines, so links the design underlines set `text-decoration` themselves.

## Rules

- Secrets (PostHog server key, the Wix client secret in `.env.local`) never reach the browser, because anything `PUBLIC_` ships in the bundle.
- `auth.elevate()` runs only in server code, and only after checking who is calling, because it grants app-level permissions.
- Backend requests are limited to 1000 CPU-ms and 20 sub-requests: keep server work small, with few external calls per request, in parallel where possible and well under 20 sub-requests (`fetchCategories` and each product list cost 2), and never process 3D files on the server.
- Wix event extensions, dashboard pages and data collections only work after `release`; collections and the first event extension need `--version-type major`.
- Analytics goes through one `track()` wrapper with a typed event catalog. Never send personal data or text the shopper typed (search terms included). Analytics failures never block the UI.
- Colors, fonts, radii and motion values live only in `src/styles/global.css`. A missing value means a missing token.
- Ask before adding a dependency or service, changing a data schema once it holds content, deleting data, releasing, or spending Wix AI credits.
- Whenever you need input, use the tool's question panel: two to four options, recommended first. Batch questions into one round.

## Building from designs

Designs arrive as images attached to the prompt (design system, home, sign in, create account, explore, product, cart). Pages must match them: layout, spacing, sizes, colors, type, radii, icons and copy, except brand marks and product data.

- A UI plan describes its design (every section, element, state, token and asset) well enough to build without the image. If you build in a fresh session and need the image, ask the user to attach it again.
- Map every value to a token. List values with no token in the plan as proposed new tokens instead of hardcoding them.
- Icons come from the chosen icon library, never redrawn from a screenshot. A missing asset gets a marked placeholder, listed in the report.
- Anything in a design without a data source yet (reviews, ratings, wishlist, member perks, shipping promises) is a decision in the plan, never faked.
- Designs are desktop. Derive phone layouts by stacking and keeping the hierarchy, and list the choices in the plan.
- After building, open the page with the Playwright MCP at 1440px and 390px, screenshot it, compare with the design, list every difference, fix, and repeat. Report which values were estimated from an image. Measure the design's canvas scale against the target width before planning sizes. Without Playwright, capture 390px by loading the page in a 390px-wide same-origin iframe (desktop Chrome won't resize narrower than about 500px), and scroll first so lazy images load.

## How we build features

The user describes what they want in a sentence or two. You work out the how.

**Small change** (you can describe the diff in one sentence), or the user says "just do it": do it, run the checks, report. If unsure, treat it as bigger.

**Anything bigger:**

1. **Understand.** Load every skill the request names, plus any whose description fits (requests name skills in plain words, such as "the wix headless kit skill" for `wix-headless-kit`). Study any attached design. Read the code involved and the current docs for every API you'll use. Open an earlier plan only if this one builds on it.
2. **Ask.** If scope, visible behavior, data shape or cost is unclear, ask in the question panel. Pick sensible defaults for the rest and list them in the plan. If a decision in this file looks wrong, raise it rather than changing it.
3. **Plan.** Copy `prompts/TEMPLATE.md` to `prompts/NN-feature-name.md` (next number), fill it in, set `Status: review`, and add it to `prompts/README.md`. The plan must be self-contained: a fresh session can build it from this file plus the plan. In Claude Code, have a reviewer subagent check it and fix real gaps.
4. **IMPORTANT: stop for approval.** Write no app code until the user approves. Summarize the plan in five lines and ask in the question panel: "Approve and build now", "Approve, I'll build in a fresh session", or "Change something". On approval set `Status: approved`.
5. **Build** step by step (in a fresh session, the user says "build plan NN": start here). Tick each step in the plan as its check passes and commit it. If a step turns out wrong, or needs something the plan didn't approve, stop and ask instead of redesigning.
6. **Verify** with evidence: run every check in the plan's Verification and show the output. In Claude Code, have a reviewer subagent compare the work with the plan and fix real gaps.
7. **Close out.** Write the plan's `## Result`, set `Status: done`, and update the index. Then propose edits to this file: rewrite or delete lines that are no longer true rather than appending. Show the proposed edits and ask before saving them. Keep this file under 150 lines.

## Reporting

End every change to code with these headings, in this order, leaving out empty ones:

- **Done:** the outcome in one line, then each file changed and how.
- **Verified:** each check with ✅ or ❌ and its evidence (command output, screenshots). Never mark ✅ without running it.
- **You need to:** actions only the user can take (dashboard settings, Tripo Studio models, payments, DNS).
- **Test it yourself:** numbered steps from a fresh start, ending with `Expected:`.
- **Notes:** defaults picked, trade-offs, follow-ups.

## Checks

- `npm run check` and `npm run build` pass before any task is called done.
- Pages that load data handle loading, empty and error states.
- Pages are compared with their design at 1440px and 390px before they're called done.
- 3D: model files stay under 5 MB, load lazily, and fall back to photos when WebGL is unavailable.
