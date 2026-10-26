# Kix

3D sneaker store. Shoppers browse, spin every shoe in 3D, recolor its upper, sole, laces and accent, and buy the result with a design code on the order. Built on Wix-managed headless (Astro, hosted by Wix).

This file is the project's memory: it holds every decision that is still true. Plans in `prompts/` are history; `prompts/README.md` indexes them. Products, prices and stock live in Wix, never in files.

## Brand

- Kix is a made-up brand with a Nike-style look. The page designs show Nike's logo and product names as references only: use a Kix wordmark (a marked placeholder until a real asset exists) and our own product data. Never use real brands' names, logos or shoe designs.
- Look: warm off-white backgrounds, near-black type and buttons, a red primary, condensed uppercase headlines, product-first layouts on soft pastel tiles. Once the design system exists, its tokens are the source of truth.
- Voice: confident, short sentences, motion words. Never invent reviews, ratings, stock levels or delivery promises.

## Commands

Use Node.js 24.18.0 or newer for Wix CLI commands.

```bash
npm run dev                       # wix dev → Astro on http://localhost:4321; Wix CLI 1.2.2 currently exits 1 while preparing its dashboard
npm run check                     # astro check (types)
npm run build                     # wix build
npm run preview                   # wix preview → shareable preview URL (backends stop after 3 days)
npm run release                   # wix release → live site. Ask the user first
npm run wix env set -- --key K --value V   # then: npm run wix env pull
npm run generate                  # wix generate → dashboard pages, events, data collections
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

The UI primitives, mock DTO file, Wix storefront layer, and styling tokens below are planned; this starter has not created them yet.

- **Hosting, deploys, secrets:** Wix (CLI). Secrets are declared in `astro.config.mjs` with `envField` and set with `wix env set`; read server secrets from `astro:env/server`.
- **UI:** our own primitives in `src/components/ui/`, built from the design system sheet. Pages compose them; callers pass layout classes only, and a caller needing a new color means a variant is missing.
- **Mock data:** until a page is wired to Wix, it reads `src/data/mock.ts`, shaped exactly like the storefront DTOs the `wix-headless-kit` skill ships (`storefront/app/wix/storefront/types.ts` in the templates it downloads), so wiring it is a swap, not a rewrite.
- **Catalog, cart, checkout, orders:** Wix Stores and Wix eCommerce (Wix's hosted checkout), through the data layer and hooks shipped by `wix-headless-kit` (`src/wix/storefront/`, `src/hooks/storefront/`). Don't rewrite that logic. Its UI components are used only where they match the designs.
- **Other data (3D model links, saved designs):** Wix CMS collections, keyed by product ID as a text field. CMS can't reference Stores products.
- **Accounts:** Wix Members through `@wix/astro`'s built-in `/api/auth/*` routes, via the `wix-headless-kit` members data layer. No custom callback pages.
- **3D models:** made by the user in Tripo Studio (the web app; no Tripo API or key) and downloaded as GLB into `models/raw/`. The agent optimizes them with glTF Transform into `models/web/`, stores them in Wix, and renders them with React Three Fiber islands (`client:only="react"`). Not set up yet.
- **Analytics, replay, flags, experiments:** PostHog. Not set up yet.
- **Styling:** Tailwind tokens in `src/styles/global.css`.

## Rules

- Secrets (PostHog server key, the Wix client secret in `.env.local`) never reach the browser, because anything `PUBLIC_` ships in the bundle.
- `auth.elevate()` runs only in server code, and only after checking who is calling, because it grants app-level permissions.
- Backend requests are limited to 1000 CPU-ms and 20 sub-requests: keep server work small, one external call per request, and never process 3D files on the server.
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
- After building, open the page with the Playwright MCP at 1440px and 390px, screenshot it, compare with the design, list every difference, fix, and repeat. Report which values were estimated from an image.

## How we build features

The user describes what they want in a sentence or two. You work out the how.

**Small change** (you can describe the diff in one sentence), or the user says "just do it": do it, run the checks, report. If unsure, treat it as bigger.

**Anything bigger:**

1. **Understand.** Load every skill the request names, plus any whose description fits (requests name skills in plain words, such as "the wix headless kit skill" for `wix-headless-kit`). Study any attached design. Read the code involved and the current docs for every API you'll use. Open an earlier plan only if this one builds on it.
2. **Ask.** If scope, visible behavior, data shape or cost is unclear, ask in the question panel. Pick sensible defaults for the rest and list them in the plan. If a decision in this file looks wrong, raise it rather than changing it.
3. **Plan.** Copy `prompts/TEMPLATE.md` to `prompts/NN-feature-name.md` (next number), fill it in, set `Status: review`, and add it to `prompts/README.md`. The plan must be self-contained: a fresh session can build it from this file plus the plan. In Claude Code, have the `plan-reviewer` agent check it and fix real gaps.
4. **IMPORTANT: stop for approval.** Write no app code until the user approves. Summarize the plan in five lines and ask in the question panel: "Approve and build now", "Approve, I'll build in a fresh session", or "Change something". On approval set `Status: approved`.
5. **Build** step by step (in a fresh session, the user says "build plan NN": start here). Tick each step in the plan as its check passes and commit it. If a step turns out wrong, or needs something the plan didn't approve, stop and ask instead of redesigning.
6. **Verify** with evidence: run every check in the plan's Verification and show the output. In Claude Code, have the `change-reviewer` agent compare the work with the plan and fix real gaps.
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
