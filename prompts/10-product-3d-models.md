# 10 · Product 3D models: shrink, upload to Wix Media, parts map and color presets in CMS

Status: done

<!-- review → approved → done, or dropped. Only the user approves. -->

**Request:** "The 3D models for our products are in the models/raw folder, with name similar to its product photo. Write a reusable script that shrinks each model to under 5 MB with its parts kept, uploads it to Wix Media and saves it in a CMS collection with its product, a map of its parts and a color preset for each of the product's colors, using the wix manage and wix app skills. Do the first product end to end and show me its parts and presets before doing the rest."

## Goal

Every Kix sneaker has a web-ready 3D model under 5 MB in Wix Media and one row in a Wix CMS collection, `ProductModels`. Each row holds the Stores product ID, the model's URL, a map from each model part to the zone a shopper recolors (upper, sole, laces, accent), and one color preset per Wix color choice. A future product-page viewer and customizer reads that row; this plan builds no storefront UI. One committed script redoes the whole pipeline for any product, so a new or remade model is one command away.

## Out of scope

- The 3D viewer and customizer on the product page (React Three Fiber, WebGL fallback, lazy loading). That's the next plan, and it reads this plan's data.
- Saved designs, design codes on orders, and analytics events.
- Remaking or editing models in Tripo Studio. Models are used as Tripo exported them, apart from shrinking and neutral shading.
- Splitting a part that Tripo merged (for example laces fused into the upper). Such a model simply has fewer recolorable zones; see Risks.
- Deleting files from Wix Media. A re-run uploads a new file and leaves the old one; the script prints its ID.
- Release. Nothing here needs one.

## Decisions

- **Collection: a plain site collection, created by one Create Data Collection call (user).** That's how Wix's headless kit (`wix-headless-templates/cms/seed/SEED.md`: `POST /wix-data/v2/collections`) and the wix-manage "CMS Schema Management" recipe create collections. The wix-app Data Collection extension exists for apps installed on other sites; Kix is one site, so it would only add a namespace and a major release. The wix-app skill was read for this and isn't used.
- **Recoloring: neutral shading textures (user).** Each part's base-color texture becomes gray shading (folds, stitching, grain), normalized so its brightest common tone is near white. The part's color comes from the material color, which a preset sets. Every color shows true, light on dark included. Two-tone detail inside a single part is lost. Each part's material color in the GLB is set to the made color's preset, so the file looks right in any viewer on its own.
  - *Built (step 4 tuning):* dividing luminance by its 95th percentile left a dark-gray ghost under every preset where Tripo baked two tones into one part (Court 1 Retro's red collar shares `tripo_part_1` with the white side panels). Luminance divided by a blurred copy of itself removed the ghost, but amplified JPEG noise in the red areas. The shipped method uses each pixel's max channel (HSV value), lightly pre-blurred, divided by a blur at width/48 px, with a flat area mapped to 0.94 and the gain capped at 4×. That keeps creases and stitching and flattens tone blocks, without noise.
- **First product: Kix Court 1 Retro** (`team-red-white.glb`, 6 parts). It's the hero product, and its red and white make the zones easy to judge.
- **Raw file → product.** The script kebab-cases each of the product's Wix color names (`Team Red / White` → `team-red-white`) and uses the one `models/raw/<name>.glb` that matches. Zero or two matches stop the script. All 12 raw files match this way (checked while planning).
- **Shrinking: glTF Transform with meshoptimizer.** Steps: weld, simplify each part, quantize, meshopt compression (`level: 'high'`), and base color and roughness-metal textures resized to at most 1024 px and saved as WebP. Normal maps are resized but kept in their source format. *Built:* they stay JPEG, not PNG as first planned. Tripo's normals are already JPEG, so PNG would add bytes without adding quality.
  - **Error limit (review finding).** `simplify()` defaults to `error: 1e-4` and quits before its target ratio at that limit. In a prototype, Court 1 Retro stayed at 691k triangles whatever the budget, and `stone` and `ocean-blue` stayed over 5 MB. So every attempt sets `error` explicitly.
  - **Retry ladder.** Every attempt rebuilds from the raw file. The script tries these in order and fails if none fits under 5 MB: (150k triangles, error 0.001) → (100k, 0.005) → (60k, 0.02) → (60k, 0.02, 512 px textures). In the prototype, the first attempt gave Court 1 Retro 150k triangles / 1.81 MB, `stone` 3.03 MB, `ocean-blue` 4.08 MB and `cloud-white` 1.66 MB.
  - **Triangle budget per part.** Each part keeps at least `min(original, 3000)` triangles, so eyelets and tabs survive. The rest of the budget is shared by triangle count. The script prints the triangles each part actually reached next to its budget.
  - **Parts are kept.** There's no `join` and no `flatten`, and materials are never renamed. `meshopt`'s internal `quantize` cleanup dedups materials only when their names match; Tripo's names are unique in all 12 files. Each part stays its own node, mesh and material, named as Tripo named it (`tripo_part_N`). After writing, the script compares node names, mesh count and material names with the raw file and fails on any difference. That catches a part `simplify` deleted for ending up empty.
  - **Why meshopt, not Draco.** three.js's loader decodes meshopt with a bundled decoder, so no decoder files are fetched from a CDN.
- **Orientation (review finding).** Most raw models point along X, but `team-red-white` (Court 1 Retro) is turned about 45° around Y and `sky-blue` is also off. The spec gets a `rotateY` (degrees). `optimize` applies it, then centers the shoe on X and Z and keeps it standing on y = 0. Every web model then faces the same way, and the CMS needs no framing field. `rotateY` is set by eye in the viewer: a first `optimize` with 0, then a re-run.
- **Color space (review finding).** Presets are sRGB hex. When `publish` writes material colors into the GLB, it converts them to linear, as three.js's `Color.set(hex)` does. The gray shading averages a little below white, so the made color can render darker than the photo. Step 4 checks this against the photo and tunes the shading normalization, never the preset hexes.
- **Shading on dark parts (review finding).** Dividing by the 95th percentile amplifies JPEG noise on dark textures, so the gain is capped at 4×. The step 7 review includes Nightshift High (`black-white.glb`) as well as Court 1 Retro, so you judge a dark model before the other 10 are done.
- **Extensions.** `FB_ngon_encoding` (Tripo's, unregistered and not required) is dropped; glTF Transform logs it as a missing optional extension, which is expected. `KHR_materials_volume` is only listed, not used by any material, so it's harmless. Meshopt adds `KHR_mesh_quantization` and `EXT_meshopt_compression`, and WebP adds `EXT_texture_webp`; three.js's `GLTFLoader` supports all three.
- **Zones are `upper`, `sole`, `laces`, `accent`.** These are the four recolor targets in AGENTS.md. Each part maps to exactly one zone; a zone can have several parts or none. I choose the mapping by looking at each part highlighted in the viewer (see Approach). Presets list only the zones a model has.
- **Presets.** One per Wix color choice, keyed by `choiceId` with the color name kept for readability. The made color's preset uses each part's average color from the original texture, grouped by zone. Other colors are read from that color's Wix product photo and its colorway text in `.seed/store-plan.json`. Hex strings like `#B3202A`.
- **Specs are committed; models aren't.** `models/specs/<slug>.json` holds the part map and presets I author. It's small, reviewable and the input to `publish`; Wix CMS holds the published copy. `models/raw/` (60–74 MB each) and `models/web/` (in Wix Media) are git-ignored. Specs hold no product names or prices; the product is identified by its slug and ID.
- **Media upload: Generate File Upload URL, then PUT** (wix-manage "Upload Media to Wix", local-file path).
  - MIME type `model/gltf-binary`. Wix Media has a `MODEL3D` media type ([file descriptor](https://dev.wix.com/docs/api-reference/assets/media/media-manager/files/file-descriptor-object.md)). Files under 10 MB don't need the resumable URL.
  - The script polls Get File every 2 s for up to 120 s. `FAILED` or a timeout is an error.
  - **Before saving `modelUrl` (review finding):** the file's `urlExpirationDate` must be empty, because an expiring URL would break later. The script then downloads `modelUrl` with an `Origin: http://localhost:4321` header. The response must carry `access-control-allow-origin`, and its size and sha256 must match the local file, which proves Wix served the file without reprocessing it. Any failure stops before the CMS write.
- **Product read.** Catalog V3 Get Product By Slug (`GET /stores/v3/products/slug/{slug}`, fields `MEDIA_ITEMS_INFO`). The color option is the one with `optionRenderType` `SWATCH_CHOICES` or `COLOR_CHOICES`, as in `src/wix/storefront/catalog-core.ts`. Choices with `visible: false` are skipped.
- **Auth: the Wix CLI's site token,** as the kit's seeds get it. The script runs `node_modules/.bin/wix token --site <siteId from wix.config.json>` and takes the first match of `/[A-Za-z0-9._-]{40,}/`, because the CLI can print update notices around the token. No new secret. Node 24.18 is needed, like every Wix CLI command here.
- **Permissions:** read `ANYONE` (shoppers' browsers will read it), insert, update and remove `ADMIN`. That's the kit's public-read default.
- **One row per product: the item's `_id` is the product ID (review finding).** `publish` writes with Bulk Save (`POST /wix-data/v2/bulk/items/save`), which inserts or replaces by `_id`. Query Data Items is eventually consistent, so a query-then-insert could create duplicates. `productId` is also stored as its own field, for readability in the CMS and for filtering. If the CMS rejects a Stores product ID as an `_id`, step 6 stops and asks.
- **ARRAY fields with a fallback.** Harmony (Wix's newest editor) sites reject `ARRAY` and `OBJECT`; a headless site is unlikely to. Step 5 checks the created collection. If the fields are rejected, I stop and ask before switching to TEXT fields holding JSON.
- **Viewer is dev tooling, not site code.** `scripts/models/viewer.html` loads three.js 0.186.1 from jsDelivr (pinned; 0.187.0 is under two weeks old) and is served by a ~30-line Node static server, `scripts/models/serve.mjs`. It isn't part of the Astro build.
- **The earlier cleanup is committed first,** as its own commit, before step 1. It's verified but uncommitted. Its files:
  - `.gitignore` (adds `3d/`)
  - six deleted photos in `public/images/home/`
  - both `SOURCES.md` files
  - `src/data/mock.ts` and `src/pages/index.astro` (product slides read their Wix photo)
  - `src/wix/storefront/catalog.ts` (adds `fetchMainImagesBySlug`). That's a second kit addition, so AGENTS.md's "One kit edit" line gets updated at this plan's close-out.
- **Plan review:** a general-purpose subagent reviewed this plan. It prototyped the pipeline on the real raw files, in the scratchpad only. It found one blocker: simplify's default error limit, which kept files over 5 MB. It also found six should-fixes: parts could vanish unnoticed, color space, the Media URL checks, duplicate CMS rows, model orientation, and the step 0 scope. Plus minor notes on token parsing, the Stores read, dark-part noise, the forced failures and ARRAY fields. All are applied above. It confirmed the package versions, the collection id and field types, the upload flow, and that no pipeline step merges parts.

## Context

- Skills: wix-manage (index; "Find Products", "Upload Media to Wix", "CMS Schema Management", "CMS Data Items CRUD"), wix-app (SKILL.md, `DATA_COLLECTION.md`, `data-collection/{SCHEMA,LIFECYCLE,PERMISSIONS}.md`, `APP_IDENTIFIERS.md`: read, then not used, see Decisions), wix-headless-templates `cms/seed/SEED.md` and `shared/seed/wix-cli.mjs` (token).
- Docs: [Generate File Upload URL](https://dev.wix.com/docs/api-reference/assets/media/media-manager/files/generate-file-upload-url), [Upload API](https://dev.wix.com/docs/api-reference/assets/media/media-manager/files/upload-api), [File descriptor](https://dev.wix.com/docs/api-reference/assets/media/media-manager/files/file-descriptor-object.md), [Create Data Collection](https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/create-data-collection), [Data Items](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/introduction), [glTF Transform](https://gltf-transform.dev/) (functions: `weld`, `simplify`, `quantize`, `meshopt`, `textureCompress`, `prune`).
- Site facts (read while planning): the CMS app (`e593b0bd-…`) is installed; the site has no custom collections. All 12 products have a `Color` option with 2 choices, each with a `colorCode` and its own photo.
- Raw models (read from each GLB's JSON header): Tripo exports, 1.9–2.0M triangles each, 3–9 parts named `tripo_part_N`, one material per part with base color (JPEG), roughness-metal (PNG, 1024 px) and normal (JPEG) maps, 4–11 MB of textures. Geometry is the bulk of each 60–74 MB file.

  | Raw file | Product | Parts |
  | --- | --- | --- |
  | `team-red-white.glb` | kix-court-1-retro | 6 |
  | `berry-pink-foam.glb` | kix-strap-high-lx | 6 |
  | `black-white.glb` | kix-nightshift-high | 5 |
  | `cloud-white.glb` | kix-circuit-trainer | 9 |
  | `forest-gum.glb` | kix-summit-high | 8 |
  | `ocean-blue.glb` | kix-pacer-2 | 5 |
  | `petal-pink.glb` | kix-orbit-high | 6 |
  | `silver-sky.glb` | kix-tempo-run | 3 |
  | `sky-blue.glb` | kix-mini-court | 4 |
  | `stone.glb` | kix-drill-tr | 4 |
  | `wheat.glb` | kix-sandlot-suede | 6 |
  | `white-sage.glb` | kix-meridian-premium | 7 |

- Builds on plan 07 (the products, their color choices and photos).

## Approach

One script, `scripts/models/models.mjs`, run as `npm run models -- <command> <slug>`:

| Command | Does | Touches Wix |
| --- | --- | --- |
| `setup` | Creates `ProductModels` if it doesn't exist (idempotent: Get Collection first) | Collection create |
| `optimize <slug>` | Reads the product from Stores, finds its raw GLB, writes `models/web/<slug>.glb` under 5 MB, and prints each part's name, triangle count and average original color. Writes a starter `models/specs/<slug>.json` if none exists (all parts `upper`, made-color preset from averages) | Read only |
| `publish <slug>` | Validates the spec against the product and the optimized GLB, applies the made-color preset as material colors, uploads to Media, waits for `READY`, upserts the CMS row. `--dry-run` stops before uploading | Media upload, CMS write |
| `view` | Serves `scripts/models/` and `models/` on `http://localhost:4400`, for the viewer | none |

`optimize` also does the neutral shading with sharp. For each part, the base color becomes luminance, divided by its 95th percentile (gain capped at 4×) and clamped to 1, so the material color does the tinting. It applies the spec's `rotateY` (0 when there's no spec yet) and recenters the shoe. It prints one table per part: node, original triangles, budget, triangles reached, average original color (sRGB hex).

**Spec shape** (`models/specs/kix-court-1-retro.json`):

```json
{
  "slug": "kix-court-1-retro",
  "raw": "team-red-white.glb",
  "madeFrom": "Team Red / White",
  "rotateY": -45,
  "parts": [
    { "node": "tripo_part_0", "zone": "upper", "label": "Upper panels" }
  ],
  "presets": [
    { "choiceId": "…", "color": "Team Red / White", "zones": { "upper": "#B3202A", "sole": "#F4F2EE", "laces": "#B3202A", "accent": "#F4F2EE" } }
  ]
}
```

**`ProductModels` collection** (id verbatim, no namespace):

| Field | Type | Holds |
| --- | --- | --- |
| `title` | TEXT | Product name when published (display field, for the CMS list only) |
| `productId` | TEXT | Wix Stores product ID (the key) |
| `modelUrl` | URL | The GLB's Wix Media URL |
| `modelFileId` | TEXT | Wix Media file ID |
| `modelBytes` | NUMBER | File size |
| `madeFrom` | TEXT | The color the model was made in |
| `parts` | ARRAY | `[{ node, zone, label }]` |
| `presets` | ARRAY | `[{ choiceId, color, zones: { upper, sole, laces, accent } }]` (only the model's zones) |

**Viewer** (`scripts/models/viewer.html?slug=…&src=local|wix`; *built:* `src` takes the model URL itself, defaulting to `models/web/<slug>.glb`, plus `view=` and a `kix.sheet()` contact-sheet mode): orbits the model; a part list highlights one part (others dimmed) for mapping; a preset picker applies a spec preset's zone colors to the materials; shows file size and triangle count. It's how I map zones, and how I show you parts and presets. Screenshots come from Chrome.

**Who owns what:** models in Wix Media, 3D data in Wix CMS (AGENTS.md: "Other data (3D model links…): Wix CMS collections, keyed by product ID as a text field"). Products stay in Stores. All 3D processing runs locally, never on the server.

**New dev dependencies (asking now):** `@gltf-transform/core`, `@gltf-transform/functions` and `@gltf-transform/extensions` 4.5.1, `meshoptimizer` 1.3.0, `sharp` 0.35.5. Used only by the local script; nothing ships to the browser. three.js is loaded only by the dev viewer, from a CDN.

## Steps

- [x] 0. Run `npm run check` and `npm run build`, then commit the earlier cleanup (the files listed in Decisions) on `main` as its own commit (check: both pass; `git status` then shows only plan 10 files and `models/`).
- [x] 1. Add the five dev dependencies; git-ignore `models/raw/` and `models/web/`; add `"models": "node scripts/models/models.mjs"` to `package.json` (check: `npm ls` lists them; `git check-ignore models/raw/team-red-white.glb`).
- [x] 2. Write `optimize` and run it on kix-court-1-retro (check: the file is under 5 MB; the script's part check passes, meaning 6 nodes `tripo_part_0`–`5`, 6 meshes and 6 materials with the raw file's names; its table shows triangles reached against budget; `extensionsUsed` lists `EXT_meshopt_compression` and `EXT_texture_webp`).
- [x] 3. Write the viewer and `view`; load the optimized model (check: Chrome screenshot of the whole shoe, plus one per part highlighted).
- [x] 4. Author `models/specs/kix-court-1-retro.json`: `rotateY` set by eye, then re-run `optimize`; a zone for each part from the screenshots; presets for both colors from the texture averages and the Wix photos (check: the shoe faces the viewer's default side like the Wix photos; viewer screenshots of both presets beside each color's Wix photo).
- [x] 5. Write `setup` and run it (check: Get Collection returns `ProductModels` with the 8 fields, `parts` and `presets` as `ARRAY`, and the permissions above).
- [x] 6. Write `publish`; run `--dry-run`, then publish kix-court-1-retro for real (check: the script's Media checks pass and are printed: `READY`, `mediaType: MODEL3D`, no `urlExpirationDate`, GET with `Origin` returns `access-control-allow-origin`, and size and sha256 match the local file; Query Data Items with `consistentRead: true` returns one row whose `_id` is the product ID and whose fields match the spec; the viewer loads the model from `modelUrl`).
- [x] 7. Run steps 2–4 and 6 for Nightshift High too (the dark model). Then **stop and show you** both products' parts and presets: the screenshots, the zone maps and the preset tables. Wait for your OK or changes.
- [x] 8. After your OK: `optimize`, map, author and `publish` the other 10, then show a contact sheet of every model in its made color, calling out any model missing zones (check: 12 rows in `ProductModels`, every file under 5 MB, every product's visible color choices have a preset).
- [x] 9. Verification below, then reviewer subagent, then close-out.

## Files

- Create: `scripts/models/models.mjs`, `scripts/models/viewer.html`, `scripts/models/serve.mjs`, `models/specs/<slug>.json` (12), `prompts/10-product-3d-models.md`
- Change: `package.json` and `package-lock.json` (dev dependencies, `models` script), `.gitignore`, `prompts/README.md`

## Acceptance criteria

- WHEN `npm run models -- optimize <slug>` runs on any of the 12 raw models THE SCRIPT SHALL write a GLB under 5 MB that keeps every original part as its own named node, mesh and material.
- WHEN `npm run models -- publish <slug>` runs THE SCRIPT SHALL upload the GLB to Wix Media and leave exactly one `ProductModels` row for that product, holding its model URL, its parts map and one preset per Wix color choice.
- WHEN the spec names a part the GLB doesn't have, a zone outside the four, an invalid hex, or misses a color choice THE SCRIPT SHALL stop before uploading and say what's wrong.
- WHEN the script runs twice for the same product THE CMS SHALL still hold one row for it.
- WHEN a browser on `localhost:4321` or the live site fetches `modelUrl` THE REQUEST SHALL succeed cross-origin.

## Verification

- `npm run check` and `npm run build` (the script isn't in the build; nothing in `src/` changes).
- The script's own size and part report for all 12 models (shown in the report as a table: raw MB → web MB, triangles, parts, zones).
- Wix: Get Collection output for `ProductModels`; Query Data Items showing 12 rows; Get File `READY` for each model.
- Media: the script's printed checks for each model (`READY`, no expiry, CORS header on a GET, size and sha256 match).
- Forced failures: `publish` with a spec that names a missing part, uses a zone outside the four, has an invalid hex, or misses a color choice. All four stop before uploading (output shown).
- Re-run `publish` for Court 1 Retro; still one row (query output).
- Viewer screenshots: each part highlighted and both presets for Court 1 Retro; a made-color contact sheet for all 12.
- No page changes, so no 390px/1440px design comparison.

## Risks and open questions

- **Wix Media and GLB.** Untested: whether Media accepts `model/gltf-binary` from Generate File Upload URL, what URL a `MODEL3D` file gets, and whether that host allows CORS (the image CDN sends `access-control-allow-origin: *`). Step 6 tests all three on the first product. If any fails, I stop and ask; the fallback would be uploading as `application/octet-stream` (a `DOCUMENT`).
- **Missing zones.** Tripo split parts by its own logic. Tempo Run has 3 parts and Drill TR and Mini Court 4, so laces or accent may be fused into the upper there. Those products get fewer recolorable zones; step 8 lists them, and fixing that means remaking the model.
- **Shading quality.** Simplifying to ~150k triangles and gray shading may lose fine detail (stitching, perforations); the normal maps carry most of it. Step 4's screenshots show it before anything is uploaded.
- **Media storage.** 12 files of ~3–5 MB; re-runs add files without deleting old ones.
- **Spend:** no Wix AI credits, no paid services.

## Result

**Shipped.** All 12 Kix sneakers have a web model in Wix Media (`static.wixstatic.com/3d/…`, `MODEL3D`, no expiry, CORS `*`) and one `ProductModels` row: `_id` = product ID, model URL, file ID and size, the color it was made in, a parts map and one preset per visible color choice. `npm run models -- optimize|publish <slug>` redoes any product; `view` serves the dev viewer.

| Product | Raw → web | Parts | Zones | Missing |
| --- | --- | --- | --- | --- |
| Circuit Trainer | 63.5 → 1.86 MB | 9 | upper, sole, laces, accent | none |
| Court 1 Retro | 61.2 → 2.28 MB | 6 | upper, sole, laces, accent | collar fused into upper |
| Drill TR | 73.6 → 3.59 MB | 4 | upper, sole, accent | laces; orange cage fused into upper |
| Meridian Premium | 61.9 → 2.34 MB | 7 | upper, sole, laces, accent | none |
| Mini Court | 61.4 → 1.98 MB | 4 | upper, sole, accent | laces (strap closure) |
| Nightshift High | 61.4 → 1.99 MB | 5 | upper, sole | laces, accent; Black / Crimson's crimson can't show |
| Orbit High | 60.4 → 2.04 MB | 6 | upper, sole, accent | laces; Grape / Teal's teal stripe can't show |
| Pacer 2 | 70.6 → 4.75 MB | 5 | upper, sole, accent | laces; Graphite / Volt's volt can't show |
| Sandlot Suede | 60.2 → 2.32 MB | 6 | upper, sole, accent | laces |
| Strap High LX | 61.7 → 2.01 MB | 6 | upper, sole, accent | laces (strap closure) |
| Summit High | 66.4 → 3.13 MB | 8 | upper, sole, accent | laces (strap closure) |
| Tempo Run | 63.3 → 2.03 MB | 3 | upper, sole, accent | laces |

**Differed from the plan, and why:**
- **Neutral shading method** (step 4, allowed as tuning): the 95th-percentile method ghosted two-tone parts dark gray. The shipped method is max-channel brightness divided by a blurred copy (see Decisions → Recoloring).
- **Normal maps stay JPEG,** not PNG, because the source is already JPEG.
- **Zone choices that don't follow the part's label:** Drill TR's midsole and Tempo Run's outsole are `accent`, so the orange midsole (Black / Blaze) and the sky-blue outsole (Silver / Sky) can be colored separately from the sole.
- **Presets follow the photos on the parts that exist.** Black / Crimson, Graphite / Volt and Grape / Teal render without their named accent color, because it sits on fused parts.
- **`publish --dry-run`** first rewrote `models/web/<slug>.glb`; after review it writes nothing.
- **Review hardening after the uploads:**
  - `publish` checks `raw`/`madeFrom` against the raw file.
  - Duplicate preset `choiceId`s fail.
  - `MODEL3D` and the CORS value are required.
  - A part simplified to 0 triangles fails.
  - `orient()` turns top-node offsets too.
  - A Node 24.18 guard was added.
  - All 12 dry-runs pass with byte-identical files, so no re-upload was needed.
- **A network error and a re-run test left 2 unused files in Wix Media:** `b8d82d_7cb51db94f7d45e1b2a7dee5013d528a.glb` and `b8d82d_6c2f48782b9d4da8b63ad2bc44fecfe7.glb`. The script never deletes.

**Verification (run):**
- `npm run check`: 0 errors. `npm run build`: Complete.
- 12 rows by consistent read, each with `_id` = `productId` and fields deep-equal to their specs (reviewer).
- Every model URL returns CORS `*` with a matching sha256, and every file is under 5 MB.
- Forced failures stop before uploading: missing part, bad zone, bad hex, missing color, wrong `madeFrom`, duplicate preset.
- Re-publishing Court 1 Retro left one row.
- Contact sheet of all 12, loaded from Wix Media.

**Lessons:**
- Tripo fuses details by its own logic, so recolorable zones depend on the export; check parts before writing presets.
- Gray-shading a texture needs local normalization: global scaling ghosts two-tone parts.
- glTF Transform's `simplify` needs an explicit `error`, or it stops short of its budget.

**One-pass prompt:** "Using wix-manage, write `npm run models` to shrink each `models/raw` GLB under 5 MB (glTF Transform + meshopt, explicit simplify error, parts kept, neutral detail shading, toe-left), upload it to Wix Media and save a `ProductModels` site collection row per product: parts map to upper/sole/laces/accent, one preset per color from its photo. Do Court 1 Retro and one dark model first and show me."
