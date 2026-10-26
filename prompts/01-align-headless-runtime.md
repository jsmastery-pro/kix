# 01 · Align Astro and Wix integration with Headless kit

Status: done

**Request:** Check this project against AGENTS.md using the wix headless kit and wix docs skills. Compare the installed Astro and Wix Astro integration versions with the ones the kit's shipped code requires, and if they differ, upgrade to match and confirm the dev server, check and build still work. Ask me about any mismatch and show me your proposed AGENTS.md fixes before saving them.

## Goal

Keep the existing Wix-managed Astro starter and site identity, align its runtime packages with the installed Headless kit's shipped code, and make the documented checks runnable.

## Out of scope

Deploying the storefront or members templates, seeding Wix, changing the site or data schema, releasing, or building shopper pages.

## Decisions

- Keep the current pages and `wix.config.json` because this is a runtime alignment, not a template deployment.
- Use the kit's shipped package ranges: Astro `^7.3.2`, `@wix/astro` `^3.0.0`, `@wix/astro-pages` `^3.0.0`, `@wix/astro-wix-hosting-adapter` `^3.0.0`, and `@astrojs/react` `^6.0.6`.
- Use the installed Node 24.18.0 for checks because the current shell's Node 22.12.0 is rejected by the installed Wix CLI (which requires >=24.18.0).
- Add `@astrojs/check` and a `check` script so the AGENTS.md command and task acceptance criterion are real. This adds a development dependency, requiring user approval under AGENTS.md.
- Leave AGENTS.md untouched until the user reviews its proposed corrections separately.
- Keep `npm run dev` as `wix dev`, per the user's follow-up. Document its wrapper failure; the Astro server it starts serves HTTP 200.

## Context

- Read `AGENTS.md`, `package.json`, `astro.config.mjs`, the installed `wix-headless-kit` and `wix-docs` skills, the shipped storefront and members `project/package.json`, and the Wix CLI instructions.
- Installed: Astro 5.18.2, `@wix/astro` 2.75.4, `@wix/astro-pages` 2.0.9, hosting adapter 2.0.5, `@astrojs/react` 4.4.2.
- Shipped storefront lockfile: Astro 7.3.3, Wix Astro integration family 3.0.0, `@astrojs/react` 6.0.6. The Wix 3 packages require Astro `^7.2.0` as a peer.
- Wix docs: https://dev.wix.com/docs/go-headless/wix-managed-headless/full-integration-astro/get-started/connect-an-existing-astro-project ; https://dev.wix.com/docs/wix-cli/command-reference/project-creation/create-headless-link
- Astro docs: https://docs.astro.build/en/reference/cli-reference/ ; https://v7-2.previews.docs.astro.build/en/guides/upgrade-to/v7/
- Baseline on shell Node 22: `npm run build` fails at the Wix CLI Node gate. On Node 24.18: build passes with warnings. `npm run check` fails because the script is absent.

## Approach

Update the five runtime package ranges and lockfile in place. Add the check dependency and script. Keep `astro.config.mjs` unless Astro 7 requires a small compatibility correction verified against docs. No Wix API calls, new secrets, seeds, or releases.

## Steps

- [x] 1. Switch the task shell to installed Node 24.18.0 (check: `node -v`).
- [x] 2. Update package ranges, check script, and lockfile (check: `npm ls` confirms the compatible major lines and no peer errors).
- [x] 3. Fix only migration errors required by Astro 7 (check: `npm run check`; no source migration edits needed).
- [x] 4. Verify build and dev server, requesting `/` locally (check: `npm run build` exits zero; `wix dev` starts Astro at 4321 and `/` returns HTTP 200; the Wix CLI dashboard wrapper then exits 1, accepted by the user as a documented limitation).
- [x] 5. Record evidence and present AGENTS.md proposed edits for review. Save no AGENTS.md changes without approval.

## Files

- Changed: `package.json`, `package-lock.json`, `.gitignore` (ignore Wrangler's generated local state). No `astro.config.mjs` change was needed.
- Created for review: this plan and `prompts/README.md`.
- Proposed, not yet changed: `AGENTS.md`.

## Acceptance criteria

- WHEN the existing site runs on Node 24.18.0 with kit-compatible package majors, THE SITE SHALL serve its current home page locally and pass `npm run check` and `npm run build`. The known Wix CLI dashboard wrapper failure is documented rather than changed, per the user's direction.
- WHEN AGENTS.md edits are proposed, THE USER SHALL see their exact wording before they are saved.

## Verification

Show `node -v`, `npm ls astro @wix/astro @wix/astro-pages @wix/astro-wix-hosting-adapter @astrojs/react @astrojs/check --depth=0`, `npm run check`, `npm run build`, and a local HTTP request to the dev server. No design screenshot is involved because no page design is changed.

## Risks and open questions

- Astro 7 may expose migration errors beyond package ranges; make only documented compatibility changes and ask if the work grows beyond this plan.
- The current shell defaults to Node 22.12.0; users need to select Node 24.18.0 for Wix CLI commands.
- The Wix CLI 1.2.2 starts the Astro server, then exits with code 1 while preparing its dashboard. The Astro server returns HTTP 200. The user chose to keep `wix dev` and document this failure.
- Approval needed for this runtime upgrade and the `@astrojs/check` development dependency. AGENTS.md changes require a separate review before saving.

## Result

Updated `package.json` and `package-lock.json` to the kit-compatible ranges and added `@astrojs/check` plus `npm run check`. Ignored Wrangler's generated `.wrangler/` state. Resolved versions: Astro 7.4.2, `@wix/astro` 3.1.0, `@wix/astro-pages` 3.0.1, hosting adapter 3.0.4, `@astrojs/react` 6.0.6, `@astrojs/check` 0.9.12. `npm ls` passed; `npm run check` returned 0 errors, 0 warnings, 0 hints; `npm run build` completed. `wix dev` launched Astro on port 4321 and `/` returned HTTP 200 with the starter title and headline, but the Wix CLI dashboard phase exited 1. The earlier same-project Astro process occupying 4321 and Cloudflare ports was stopped, so the failure also occurred without that collision. No Astro source/config migration was needed. AGENTS.md remains unchanged for user review. This plan differed by accepting the Wix CLI wrapper limitation and ignoring newly generated Wrangler state. A shorter prompt for this outcome: “Align this starter's Astro/Wix packages with the installed Headless kit, add astro check, verify under Node 24, and document Wix CLI dev wrapper failures without changing the dev script.”
