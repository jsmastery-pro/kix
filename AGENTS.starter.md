# Kix

3D sneaker store. Shoppers browse, spin every shoe in 3D, recolor each of its parts, and buy the result with a design code on the order. Built on Wix-managed headless (Astro, hosted by Wix).

This file is the project's memory: it holds every decision that is still true. Plans in `prompts/` are history; `prompts/README.md` indexes them. Products, prices and stock live in Wix, never in files.

## Brand

- Kix is a made-up brand with a Nike-style look. The page designs show Nike's logo and product names as references only: use a Kix wordmark (a marked placeholder until a real asset exists) and our own product data. Never use real brands' names, logos or shoe designs. One exception: Google's official G on a Continue with Google button, which Google's sign-in guidelines require.
- Look: warm off-white backgrounds, near-black type and buttons, a red primary, condensed uppercase headlines, product-first layouts on soft pastel tiles. Once the design system exists, its tokens are the source of truth.
- Voice: confident, short sentences, motion words. Never invent reviews, ratings, stock levels or delivery promises.

## Commands

The Wix CLI needs Node.js 24.18.0 or newer. Check `node -v`; if the shell's default is older, prefix Wix commands with the newer Node's `bin` on `PATH` and record the exact prefix here.

```bash
npm run dev                       # wix dev → http://localhost:4321
npx astro dev --port 4321 --background   # plain Astro dev server, if wix dev fails. One per project; stop: npx astro dev stop; logs: npx astro dev logs (restart if they go stale)
npm run check                     # astro check (types)
npm run build                     # wix build
npm run preview                   # wix preview → shareable preview URL (backends stop after 3 days)
npm run release -- --version-type minor --comment "…"   # wix release → live site, no prompts. Ask the user first
npm run wix env set -- --key K --value V   # then: npm run wix env pull
npm run generate                  # wix generate → dashboard pages, events, app data collections
```

Sign-in only works on port 4321, the one local origin the OAuth app allows: stop any stale server holding it first. All Wix CLI commands: `node_modules/@wix/cli/agents/instructions.md`.

## Docs first

Every tool here changes fast. Never assume a version. Read declared ranges in `package.json` and resolved versions in `package-lock.json` or `npm ls`, then read the docs for those versions before writing any Wix, Astro or PostHog code. When a skill's playbook and the installed package's source disagree, trust the source. When a Wix skill needs a newer version than the one installed, say so and plan the upgrade as its own step.

- **Wix:** Wix skills are installed in `node_modules/@wix/agent-skills/skills/`. Load the matching skill: `wix-headless-kit`, the Wix Headless skill (Wix's shipped store, members and CMS code, seeding, releases), `wix-app` (dashboard pages, backend events, app data collections), `wix-design-system` (dashboard UI), `wix-manage` (site settings via API), `wix-docs` (any API lookup). Use the Wix MCP when connected; otherwise use the `curl` lookup flow in `wix-docs`. A prompt that points at `wix.com/headless/skill.md` means the same Wix Headless skill. In this folder it reuses the site in `wix.config.json`. Keep our pages and code, add only what the request needs, seed nothing without asking, and follow this file's workflow and rules.
- **Astro:** check the official docs for the installed major before writing Astro code; use the Astro Docs MCP (`astro-docs`) when connected.
- **PostHog:** when connected, use the PostHog plugin's skills (`posthog:instrument-product-analytics`, `posthog:instrument-error-tracking`, `posthog:instrument-feature-flags`, `posthog:building-a-dashboard`, `posthog:creating-experiments`) and the PostHog MCP. If the MCP isn't authorized, say so and ask the user to authorize it before any step that needs it. Docs: https://posthog.com/docs (Astro page; JS config for the current `defaults` value).
- **Browser:** use the Playwright MCP when connected; otherwise use available browser tooling to open pages and take screenshots.

## Who owns what

Each tool has one job. Ask before moving a responsibility to a different tool. Close-outs fill in details here.

- **Hosting, deploys, secrets:** Wix (CLI). Secrets are declared in `astro.config.mjs` with `envField` and set with `wix env set`; read server secrets from `astro:env/server`.
- **UI:** our own primitives in `src/components/ui/`, built from the design system sheet. Pages compose them; callers pass layout classes only, and a caller needing a new color means a variant is missing. React islands use React twins of the primitives with the same classes; keep them in step.
- **Mock data:** until a page is wired to Wix, it reads `src/data/mock.ts`, shaped exactly like the storefront DTOs the `wix-headless-kit` skill ships (`storefront/app/wix/storefront/types.ts` in the templates it downloads), so wiring it is a swap, not a rewrite.
- **Catalog, cart, checkout, orders:** Wix Stores and Wix eCommerce (Wix's hosted checkout), through the data layer and hooks shipped by `wix-headless-kit` (`src/wix/storefront/`, `src/hooks/storefront/`). Don't rewrite that logic. Its UI components are used only where they match the designs, and they use theme tokens we don't define (`bg-foreground`, `text-muted-foreground`, `rounded-control`…): alias them in `global.css` before mounting one. The kit's deploy never overwrites existing files, so merge its pieces into our layout by hand. Seed inputs and scripts live in git-ignored `.seed/`.
- **Images (product, category and page photos):** before any image work, ask the user where images come from, unless this file already records the answer:
  - a folder they provide, or images attached alongside a design: use those first, matched to products and colors by file name;
  - Wix AI generation: costs Wix AI credits, so ask first, and check the site is eligible for credits before planning a run or a regeneration. Generate every colorway of a product from one shared, detailed silhouette description, or the colorways come out as different shoes;
  - a stock source (Unsplash, Pexels or another): check the license, and record each photo's source and credit.

  Record the answer here. Once photos are uploaded to Wix, ask whether to remove local copies from `public/`, since everything there ships with the site. When product photos come from Wix AI or a stock source, the 3D models don't exist yet: the report's **You need to** says so and explains how to make them (see 3D models).
- **Other data (3D model links, saved designs):** Wix CMS site collections, created by API (`POST /wix-data/v2/collections`) and keyed by product ID as a text field, because CMS can't reference Stores products. Member-owned data uses `SITE_MEMBER_AUTHOR` read/update/remove and `SITE_MEMBER` insert, read and written from the browser as the member; filter on `_owner` = the member's `id` (not `contactId`).
- **Accounts:** Wix Members through `@wix/astro`'s built-in `/api/auth/*` routes and the `wix-headless-kit` members data layer. No custom callback pages. Before planning signup, probe the site's signup policy with one JSON POST to `/api/auth/signup`: Wix may require reCAPTCHA by default. `@wix/astro` has no reset route, so forgot password calls Send Recovery Email. Signup takes only email and password; save names afterwards with `updateMember`.
- **3D models:** one per product, made by the user with any 3D or image-to-3D tool, from one colorway's product photo. The user exports a GLB to `models/raw/<product-slug>.glb` (git-ignored). Each model needs: the real shoe's proportions; separate meshes for the parts to recolor (upper, sole, laces, accent); PBR textures; any size, since the script shrinks it. Record which colorway each model was made from. A project script, built in its own plan, shrinks each one under 5 MB with its parts kept, bakes neutral shading so color presets show true, uploads it to Wix Media, and saves a CMS item with the model URL, a part-to-zone map and one color preset per product color. Per-product specs (zones, presets) are committed; models and temporary files never go in the repo. Rendered in a React island with React Three Fiber, loaded lazily on demand behind an `import.meta.env.SSR` guard so three.js stays out of the server build. Match the R3F major to the installed React major (R3F 9 needs React 19). Load no decoders or environment maps from CDNs.
- **Analytics, replay, flags, experiments:** PostHog through one `track()` wrapper in `src/scripts/analytics.ts` with a typed event catalog. Experiments pick each visitor's version on the server and bootstrap posthog-js with it, so the page never flickers.
- **Styling:** tokens and primitive styles in `src/styles/global.css`; page layout in `src/styles/site.css` (sizes and grids only).

## Rules

- Secrets (PostHog server key, the Wix client secret in `.env.local`) never reach the browser, because anything `PUBLIC_` ships in the bundle.
- `auth.elevate()` runs only in server code, and only after checking who is calling, because it grants app-level permissions.
- Backend requests are limited to 1000 CPU-ms and 20 sub-requests: keep server work small, with few external calls per request, in parallel where possible and well under 20 (a category list or a product list can cost 2), and never process 3D files on the server.
- Wix app extensions (backend events, dashboard pages, app data collections) only work after `release`; app collections and the first event extension need `--version-type major`. Site CMS collections don't need a release: create them by API.
- Analytics never sends personal data or text the shopper typed (search terms included); PostHog's personal-data masking skips `$referrer`, so mask it in `before_send`. Pin PostHog's `defaults` to a dated value. Analytics failures never block the UI.
- A page whose HTML differs per visitor (a server-picked experiment version) sends `Cache-Control: private, no-store`.
- Colors, fonts, radii and motion values live only in `src/styles/global.css`. A missing value means a missing token. Shoe color data (CMS presets) isn't UI styling.
- Ask before adding a dependency or service, changing a data schema once it holds content, deleting data, releasing, or spending Wix AI credits.
- Whenever you need input, use the tool's question panel: two to four options, recommended first. Batch questions into one round.

## Building from designs

Designs arrive as images attached to the prompt (design system, home, sign in, create account, explore, product, cart). Pages must match them: layout, spacing, sizes, colors, type, radii, icons and copy, except brand marks and product data.

- A UI plan describes its design (every section, element, state, token and asset) well enough to build without the image. If you build in a fresh session and need the image, ask the user to attach it again.
- Measure the design's canvas scale against the target width (1440) before planning sizes; don't infer it from text sizes.
- Map every value to a token. List values with no token in the plan as proposed new tokens instead of hardcoding them.
- Icons come from the chosen icon library, never redrawn from a screenshot. A missing asset gets a marked placeholder, listed in the report.
- Anything in a design without a data source yet (reviews, ratings, wishlist, member perks, shipping promises) is a decision in the plan, never faked.
- Designs are desktop. Derive phone layouts by stacking and keeping the hierarchy, and list the choices in the plan.
- After building, open the page at 1440px and 390px, screenshot it, compare with the design, list every difference, fix, and repeat. Report which values were estimated from an image. Desktop Chrome won't go narrower than about 500px: capture 390px with device emulation or a 390px-wide same-origin iframe, and scroll first so lazy images load.

## Known gotchas

- **Tailwind preflight** strips link underlines (links the design underlines set `text-decoration`) and a `<dialog>`'s `margin: auto`. Test new primitives inside a real `<button>`, not only on links.
- **CSS order:** in `global.css`, a variant declared before its base rule loses at equal specificity; check order when a state style doesn't apply.
- **Kit data layer:** `fetchCategories()` never throws, so detect failure from an empty result. Check that counts and lists use the same query. The kit's seed shares info sections by title, so give each product's sections a unique name. A kit store's `loading` flag is true during SSR: dim only on the shopper's own changes.
- **React islands:** commit range inputs on the native `change` event, not React's per-step `onChange`. Async results that update state need a revision check.
- **3D:** check a model's separate parts before writing color presets; fused parts can't be recolored apart. Neutral shading needs local normalization, or two-tone parts turn gray. glTF Transform's `simplify` needs an explicit `error`. Frame a model standing on the floor yourself (drei `Bounds` misframes it). List lazily imported 3D packages in `vite.optimizeDeps.include`, or the dev server reloads mid-request.

## How we build features

The user describes what they want in a sentence or two. You work out the how.

**Small change** (you can describe the diff in one sentence), or the user says "just do it": do it, run the checks, report. If unsure, treat it as bigger.

**Anything bigger:**

1. **Understand.** Load every skill the request names, plus any whose description fits (requests name skills in plain words, such as "the wix headless kit skill" for `wix-headless-kit`). Study any attached design. Read the code involved and the current docs for every API you'll use. Open an earlier plan only if this one builds on it.
2. **Ask.** If scope, visible behavior, data shape or cost is unclear, ask in the question panel. Pick sensible defaults for the rest and list them in the plan. If a decision in this file looks wrong, raise it rather than changing it.
3. **Plan.** Copy `prompts/TEMPLATE.md` to `prompts/NN-feature-name.md` (next number), fill it in, set `Status: review`, and add it to `prompts/README.md`. The plan must be self-contained: a fresh session can build it from this file plus the plan.
4. **IMPORTANT: stop for approval.** Write no app code until the user approves. Summarize the plan in five lines and ask in the question panel: "Approve and build now", "Approve, I'll build in a fresh session", or "Change something". On approval set `Status: approved`.
5. **Build** step by step (in a fresh session, the user says "build plan NN": start here). Tick each step in the plan as its check passes and commit it. If a step turns out wrong, or needs something the plan didn't approve, stop and ask instead of redesigning.
6. **Verify** with evidence: run every check in the plan's Verification and show the output.
7. **Close out.** Write the plan's `## Result` with what differed from the plan and the lessons learned, set `Status: done`, and update the index. Then propose edits to this file: rewrite or delete lines that are no longer true rather than appending, and move lasting lessons into Known gotchas. Show the proposed edits and ask before saving them. Keep this file under 150 lines.

## Reporting

End every change to code with these headings, in this order, leaving out empty ones:

- **Done:** the outcome in one line, then each file changed and how.
- **Verified:** each check with ✅ or ❌ and its evidence (command output, screenshots). Never mark ✅ without running it.
- **You need to:** actions only the user can take (dashboard settings, 3D models, payments, DNS, authorizing an MCP).
- **Test it yourself:** numbered steps from a fresh start, ending with `Expected:`.
- **Notes:** defaults picked, trade-offs, follow-ups.

## Checks

- `npm run check` and `npm run build` pass before any task is called done.
- Pages that load data handle loading, empty and error states.
- Pages are compared with their design at 1440px and 390px before they're called done.
- 3D: model files stay under 5 MB, load lazily, and fall back to photos when WebGL is unavailable.
