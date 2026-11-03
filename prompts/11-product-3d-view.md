# 11 · Product 3D view: spin the shoe in the color the shopper picked

Status: approved

<!-- review → approved → done, or dropped. Only the user approves. -->

**Request:** "Turn on the 3D view on the product page. The 3D button and the 3D View thumbnail should open a React Three Fiber viewer that loads the shoe's model from Wix in the color the shopper picked, and show the photos if 3D can't load."

## Goal

On `/products/<slug>`, a shopper presses the 3D pill or the 3D View thumbnail and the main photo frame becomes a 3D view of that sneaker. The model comes from Wix Media through the product's `ProductModels` row (plan 10), and its parts take the colors of the shopper's color pick. Picking another color recolors the shoe in place. Dragging or swiping spins it. Pressing "Photos" or any photo thumbnail goes back to the photos. When the browser has no WebGL or the model fails to load, the shopper sees the photos with a short note, and the 3D controls turn off for the rest of the visit. three.js and the model download only when 3D is opened.

## Out of scope

- Recoloring individual zones (the customizer), design codes and saved designs. This plan shows each Wix color's preset only.
- Zoom and pan (user: spin only).
- 3D on cards, the home page or the explore page.
- Changing models, specs or `ProductModels` rows. This plan only reads them.
- Upgrading React. R3F 8 is the line that supports React 18.3.1 (user).
- Release.

## Decisions

- **The viewer opens in the photo frame (user).** The 3D View tile behaves like one more thumbnail: pressed, it shows the 3D canvas in `.ui-gallery__frame` and gets the black `aria-pressed` border. The pill turns into a "Photos" toggle in 3D mode. Only that pill and the photo thumbnails leave 3D. A color pick in 3D mode recolors the model and stays in 3D. The photo still follows the pick behind the scenes, so "Photos" opens on the picked color's photo.
- **Packages (user): `three` 0.186.1, `@react-three/fiber` 8.18.0, `@react-three/drei` 9.122.0, and `@types/three` 0.186.0 as a dev dependency.**
  - three 0.186.1 is the version the plan 10 dev viewer used to approve every preset. 0.187.0 is under two weeks old (2026-10-30).
  - R3F 8.18.0 is the last 8.x and its peers are `react >=18 <19`. drei 9.122.0 is the last 9.x and needs R3F `^8`.
  - Pinned exactly, like the plan 10 dev dependencies, so an install can't move them.
- **What drei is used for:** `OrbitControls` (spin) and `useGLTF` (load and cache).
  - `useGLTF` runs with Draco off (`useGLTF(url, false)`). With its default, drei would fetch a decoder from gstatic.com if a file were Draco-compressed. Our models use meshopt instead, and three-stdlib 2.36's inline WASM decoder handles that with no network fetch.
  - drei's `Environment` presets fetch HDR files from a CDN. So lighting uses three's own `RoomEnvironment`, the same lighting plan 10 approved the presets under.
  - drei's `Bounds` is not used: it frames from the camera's absolute position and flies the camera in (see Camera).
- **drei's stats-gl brings a second three.js (review).** stats-gl 2.4.2 has a hard dependency on `three ^0.170.0`, so npm installs a nested three@0.170.0 under it. StatsGl is unused and drei is `sideEffects: false`, so it never reaches the bundle (checked in a prototype build: one `REVISION "186"`). No `overrides` entry; the step 2 check confirms a single three in the built chunk.
- **Products without a model keep disabled controls (user).** No `ProductModels` row (Wix's sample products, or a failed read) → both controls stay `aria-disabled="true"`, focusable, with the tooltip and name "3D view not available". They use today's `.ui-soon` look.
- **Spin only (user).** `<OrbitControls makeDefault enableZoom={false} enablePan={false} enableDamping={!reducedMotion} />`.
  - `makeDefault` lets `Fit` and the arrow keys reach the controls through `useThree((s) => s.controls)`.
  - drei's `keyEvents` stays off (its default).
  - With zoom off, three-stdlib returns from the wheel handler before `preventDefault`, so the page scrolls. It sets `touch-action: none` on R3F's wrapper itself.
  - Vertical tilt is kept, so a shopper can look at the sole.
- **Which color shows.**
  1. The shopper's color pick (`d.optionGroups` color group, the selected `choiceId`) → the `ProductModels` preset with that `choiceId`.
  2. No pick yet (the kit pre-selects nothing) → the preset whose choice photo (`choice.imageUrl`, by `mediaKey`) is the photo in the frame when 3D opens. A shopper looking at the Black / Sail photo gets Black / Sail.
  3. Otherwise the first color choice's preset, then the GLB's own colors (its made color, written in by `publish`).

  A part whose zone has no color in the preset keeps its GLB color. drei caches one `gltf.scene` for the page's life, so recolors would carry over between opens. To prevent that, each mesh's material is cloned once per scene (a `WeakSet` guard), and its original color is kept in `material.userData.original`. Every apply resets to the original, then sets the preset. Colors are set with `material.color.set(hex)`, which converts sRGB hex to linear as `publish` and the dev viewer do. Part names sit on the `THREE.Mesh` objects themselves (`tripo_part_N`, children of `ROOT`; checked in the prototype), so colors map by `mesh.name`.
- **Server read, one item by ID.** The page reads the row with Get Data Item (`GET /wix-data/v2/items/{productId}?dataCollectionId=ProductModels`) through the kit's `wixFetch()` in `src/wix/sdk.ts`. That needs no new SDK package (`@wix/data` isn't installed) and uses the same ambient auth as everything else. Collection read permission is `ANYONE` (plan 10). It runs in the page's second wave, beside the recommendation lists, because it needs the product ID. That's 1 sub-request, so the page stays well under 20. A 404 means no model. Any other failure is logged and treated as no model, so it never breaks the page.
- **The island passes only what the viewer needs:** `{ modelUrl, parts: [{ node, zone }], presets: [{ choiceId, zones }] }`. `title`, `label`, `modelFileId`, `modelBytes` and `madeFrom` stay on the server. The DTO is validated: `modelUrl` must be `https://static.wixstatic.com/…`, every zone one of the four, every hex `/^#[0-9a-f]{6}$/i`. An invalid row is logged and treated as no model.
- **Lazy loading inside the existing island, not a separate `client:only` island.** AGENTS.md says R3F islands are `client:only="react"`. The viewer needs the live color pick from `useProductDetail`, which lives in the `ProductView` island, so a second island would need cross-island state. Instead `ProductGallery` loads `ShoeViewer` with `lazy(() => import.meta.env.SSR ? Promise.resolve({ default: () => null }) : import('./ShoeViewer'))` and mounts it only after a press in the browser. The SSR guard keeps three, R3F and drei out of `dist/server`, so the Wix deploy doesn't grow. Nothing 3D runs on the server, and three, R3F, drei and the model download only on that press. Close-out proposes rewording that AGENTS.md line.
- **WebGL check at press time.** On the first 3D press, a throwaway canvas tries `webgl2`, then `webgl`, and then releases its context with `getExtension('WEBGL_lose_context')?.loseContext()`, because browsers cap live contexts. No context → no 3D (see Fallback). Checking on press, not on mount, keeps every page view free of the probe and makes the fallback testable by stubbing `getContext`.
- **Fallback.** These all end the same way: back to photos, a note in the frame, and both 3D controls `aria-disabled` with the tooltip "3D view isn't available right now" until the page reloads.
  - No WebGL.
  - The chunk fails to import.
  - The model fails to fetch or parse. R3F 8's Canvas re-throws loader errors to the DOM tree. One error boundary wraps the lazy element **and** its `<Suspense>`, so it catches both a failed `import()` and a model error.
  - The WebGL context is lost while 3D is showing. R3F 8 calls `gl.forceContextLoss()` about 500 ms after the canvas unmounts, so a plain "Photos" press also fires `webglcontextlost`. The listener therefore lives in a `useEffect` inside the Canvas tree, removed in its cleanup, and the gallery ignores the event unless it's still in 3D mode.
  - Loading takes over 20 s.

  The note reads "3D view couldn't load. Showing photos." in a `role="status"` line at the bottom of the frame, and it clears on the next photo move. `captureError(error, 'model_load')` reports load and import errors.
- **Loading state.** The gallery draws it itself while `mode === 'loading'`: the current photo stays, dimmed, with a spinner and "Loading 3D…" (`role="status"`). The `<Suspense>` fallback is `null`, and the canvas stage stays at opacity 0 until `onReady`, then fades in. That avoids R3F's flicker: an empty canvas mounts, then suspends again while it measures. Reopening 3D later is instant: drei's loader caches the parsed model for the page's life.
- **Accessibility.**
  - The canvas wrapper is `role="group"` with `aria-roledescription="3D viewer"` and the name "{name} in 3D, {color name}. Drag or use arrow keys to spin." The name updates on recolor.
  - It's focusable (`tabIndex={0}`). Left and Right arrow keys spin the shoe 15° per press: `controls.setAzimuthalAngle(controls.getAzimuthalAngle() ± Math.PI / 12)`, then `invalidate()`.
  - The pill drops `aria-pressed` and changes its label instead. In photo mode it shows `Rotate3d` and "3D" and is named "Show 3D view". In 3D mode it shows `Images` and "Photos" and is named "Show photos".
  - The 3D View tile is `aria-pressed`, like the photo thumbnails, and is named "Show 3D view".
  - `prefers-reduced-motion`: damping off. There's no auto-rotate or camera fly-in anyway.
- **Hint.** A small "Drag to spin" chip at the top-left of the frame in 3D mode, since the design has no 3D state. It hides after the first drag.
- **Hidden in 3D mode:** prev/next arrows and the expand button. They act on photos.
- **Render cost.** `frameloop="demand"` (R3F renders only when the controls move or a color changes) and `dpr={[1, 2]}`. The canvas is transparent over the frame's `--color-muted-fill`. Leaving 3D unmounts the canvas, which frees the WebGL context.
- **Tone mapping is set explicitly:** `gl={{ alpha: true, toneMapping: THREE.NeutralToneMapping }}`. R3F 8 defaults to ACES Filmic, which would shift the presets; the `gl` props override it (verified in the prototype).
- **Camera: our own `Fit` component, not drei's `Bounds` (review).** Bounds aims from the camera's absolute position, so `[0, 0.15, 1]` sat below the shoe's center (y ≈ 0.41) and showed it from under the sole. It also flew the camera in over 1 s and never refit after a resize. Plan 10 turned every model toe-left and stood it on y = 0, so one side view fits all. `Fit` runs in a `useLayoutEffect` keyed on the canvas size and the controls:
  1. `Box3.setFromObject(scene)` gives the center and size.
  2. `dist = 1.15 * max((h/2)/tan(vfov/2), (len/2)/tan(hfov/2)) + depth/2`, with fov 30.
  3. `controls.target = center` and `camera.position = center + normalize([0, 0.15, 1]) * dist` (the dev viewer's "side" view).
  4. `controls.update()`, then `invalidate()`.

  In the prototype this put the camera at (0, 0.83, 2.78) aiming at (0, 0.41, 0), a correct side view.
- **Analytics.** Two new catalog events, product ID only:
  - `product_3d_opened: { product_id, source: 'pill' | 'thumbnail' }`, sent once per open.
  - `product_3d_failed: { product_id, reason: 'no_webgl' | 'load_error' | 'timeout' | 'context_lost' }`.

  New `ErrorArea` `'model_load'`.
- **Plan review.** A general-purpose subagent reviewed this plan and prototyped it in the scratchpad. It found two blockers:
  - drei's `Bounds` framed the shoe from below → replaced by our own `Fit`;
  - `npm ls` shows a nested three from stats-gl → the step 2 check now allows it.

  It also found these should-fixes, all applied above:
  - `makeDefault` and the arrow-key method;
  - R3F's context loss on a normal unmount;
  - explicit tone mapping;
  - the loading layer and error boundary placement;
  - the SSR guard on `lazy`;
  - the expected chunk-size warning;
  - original colors kept per material;
  - releasing the WebGL probe;
  - the pill's accessible name;
  - enabled pill styles;
  - the fetch stub for `Request` objects.
- **Known console warning.** R3F 8 creates a `THREE.Clock`, which three r183+ marks deprecated with a one-time console warning. It's harmless. Moving to `Timer` needs R3F 9 (React 19).

## Context

- AGENTS.md; plan 09 (the gallery, the disabled 3D controls, the design notes for the pill and tile); plan 10 (`ProductModels` fields, specs, orientation, color space, the dev viewer's lighting and camera).
- Code read: `src/pages/products/[slug].astro`, `src/components/storefront/ProductView.tsx`, `src/components/ui/ProductGallery.tsx`, `src/wix/sdk.ts` (`wixFetch`), `src/wix/media.ts` (`mediaKey`), `src/wix/storefront/types.ts`, `product-detail-store.ts` (selection, `imageUrl`), `src/scripts/analytics.ts`, the gallery rules in `src/styles/global.css` and `site.css`, `scripts/models/viewer.html`, `models/specs/kix-court-1-retro.json`.
- Docs: [Get Data Item](https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/get-data-item.md) (REST, `dataCollectionId` query param, response `dataItem.data`); R3F v8 `Canvas` (`frameloop`, `dpr`, `gl`, `onCreated`), drei v9 `OrbitControls`, `Bounds`, `useGLTF(path, useDraco, useMeshopt)`, `useProgress` (read from drei 9.122.0's published source: `core/Gltf.js` defaults the Draco decoder to gstatic.com); three r186 `Clock` deprecation (`src/core/Clock.js`).
- npm (checked 2026-11-03): three 0.186.1 (2026-09-24), 0.187.0 (2026-10-30); @react-three/fiber 8.18.0 (2025-02-19, peers react `>=18 <19`, three `>=0.133`); @react-three/drei 9.122.0 (2025-02-19, peers react `^18`, fiber `^8`, three `>=0.137`); @types/three 0.186.0.
- **Plan review prototype** (scratchpad only, headless Chrome with SwiftShader, Vite 8 build):
  - The three packages install with no peer errors.
  - `useGLTF(url, false)` loads and recolors Court 1 Retro.
  - three-stdlib 2.36.1 parses all 12 `models/web` files.
  - The lazy chunk is 963 KB minified, 258 KB gzipped (three is 728 KB of it).
  - Our TSX type-checks against `@types/three@0.186.0`. three-stdlib's `.d.ts` errors are skipped by `skipLibCheck`.
- Skills: wix-docs (the lookup flow, for Get Data Item). No Wix MCP connected.

## Approach

```
[slug].astro (server)
  wave 1: product · SEO · categories                      (unchanged)
  wave 2: related lists · fetchProductModel(product.id)  (new, src/wix/models/product-models.ts)
            GET /wix-data/v2/items/{id}?dataCollectionId=ProductModels via wixFetch → ProductModel | null
  <ProductView client:load initial eyebrow summaryHtml model={ProductModel | null} />
     useProductDetail → color group (selected choiceId, choices with imageUrl)
     <ProductGallery … model colorGroup productId />
        mode: 'photos' | 'loading' | '3d';  unavailable: null | 'no_model' | 'failed'
        press 3D → hasWebGL()? → mode 'loading' (gallery draws dimmed photo + spinner)
        <ErrorBoundary><Suspense fallback={null}> lazy(ShoeViewer, SSR-guarded) </Suspense></ErrorBoundary>
        resolvePreset(model, colorGroup, framePhotoUrl) → { zones, colorName }   (src/wix/models/presets.ts, pure)
        <ShoeViewer url parts zones label onReady onError onContextLost />   (src/components/storefront/ShoeViewer.tsx)
           <Canvas frameloop=demand dpr=[1,2] camera={{ fov: 30 }} gl={{ alpha: true, toneMapping: NeutralToneMapping }}>
             RoomEnvironment PMREM · useGLTF(url, false) · clone materials once per scene, keep userData.original
             effect: zones → reset to original, then mesh.material.color.set(hex) by mesh.name → invalidate()
             <Fit /> (camera from the box) · <OrbitControls makeDefault enableZoom=false enablePan=false />
             effect: webglcontextlost listener with cleanup · arrow keys → setAzimuthalAngle
```

**Owners.** The model file: Wix Media. The row: Wix CMS `ProductModels`, read on the server. Selection: the kit's `useProductDetail`. Rendering: R3F in our island. Analytics: `track()` / `captureError()`. Nothing is written to Wix.

**Types** (`src/wix/models/presets.ts`, client-safe, no SDK imports):

```ts
export type Zone = 'upper' | 'sole' | 'laces' | 'accent';
export interface ProductModel {
  modelUrl: string;
  parts: { node: string; zone: Zone }[];
  presets: { choiceId: string; zones: Partial<Record<Zone, string>> }[];
}
export function resolvePreset(model, colorGroup, framePhotoUrl): { zones; colorName: string | null }
```

**Styles** (`global.css`, primitives). There are no new tokens: every value maps to an existing one.

| Class | Look | Tokens |
| --- | --- | --- |
| `.ui-gallery__stage` | The canvas wrapper. `position: absolute; inset: 0`, fades in with `opacity` over `--ds-motion-base`, `touch-action: none`, focus ring as other controls | `--ds-motion-base` |
| `.ui-gallery__loading` | Centered spinner and "Loading 3D…" in a white pill, over the photo dimmed to `--ds-busy-opacity` | `--color-white`, `--radius-pill`, `--shadow-arrow`, `--ds-motion-spin` (`ui-spin` keyframes) |
| `.ui-gallery__hint` | "Drag to spin" chip, top-left at the expand button's inset, small sans, secondary text on white | `--color-white`, `--radius-pill`, `--color-text-secondary` |
| `.ui-gallery__note` | The fallback note, bottom-left above the pill on a white pill | `--color-white`, `--radius-pill`, `--color-text-secondary` |
| `.ui-gallery__3d` (enabled) | Same look as today. Adds hover (`--color-muted-fill`), `:focus-visible` (the controls' ring) and `:active` (1px down, keeping `translateX(-50%)`). In 3D mode only the icon and label switch | `--color-muted-fill`, `--ds-motion-fast` |

**Phone (390px).** Same structure: the frame is `min(100vw - 32px, 29vh)` tall there (plan 09), and the canvas fills it. `touch-action: none` on the canvas only, so a vertical swipe on the canvas spins the shoe, while the rest of the page still scrolls. The hint and note use 12px type and sit inside the frame.

## Steps

- [x] 1. **Read the row.** Write `src/wix/models/presets.ts` (types, `resolvePreset`) and `src/wix/models/product-models.ts` (`fetchProductModel(productId)`: Get Data Item through `wixFetch`, 404 → null, validate → DTO). Wire it into the second wave in `[slug].astro` and pass `model` to `ProductView` (unused for now). (check: `npm run check`. On the dev server, the page's SSR props for `kix-court-1-retro` carry its `modelUrl`, 6 parts and 2 presets. A Wix sample product's carry `model: null`, its page still renders, and the server log shows no error for the 404.)
- [x] 2. **Packages.** `npm i -E three@0.186.1 @react-three/fiber@8.18.0 @react-three/drei@9.122.0` and `npm i -D -E @types/three@0.186.0` (check: `npm ls` shows no peer-dependency errors; the only extra three is stats-gl's nested 0.170.0, see Decisions).
- [x] 3. **Viewer.** `src/components/storefront/ShoeViewer.tsx`, as in Approach:
  - the Canvas with Neutral tone mapping and RoomEnvironment;
  - `useGLTF(url, false)`;
  - materials cloned once, with their original colors kept;
  - zone colors by `mesh.name`;
  - `Fit` and `OrbitControls makeDefault` (spin only);
  - arrow keys;
  - `onReady`, `onError` and the context-loss effect.

  The error boundary and the SSR-guarded `lazy` live in the gallery. (check:
  - a temporary `?debug3d` render on Court 1 Retro shows the shoe side-on, not from below, in Team Red / White, matching plan 10's contact sheet;
  - `npm run build`'s client output has a separate 3D chunk, about 960 KB minified / 260 KB gzipped (the prototype's baseline). Vite's "chunks larger than 500 kB" warning is expected for it; don't split it;
  - the chunk holds a single three (one `REVISION` "186");
  - `dist/server` is about the same size as before this plan (7.6 MB).

  Both sizes go in the report.)
- [x] 4. **Gallery wiring.** `ProductGallery` gets `model`, `colorGroup` and `productId`. It adds the modes, the lazy import, the WebGL check, the 20 s timeout, the pill toggle, the pressed tile, hidden arrows and expand, loading, hint, note and the disabled states. Remove the `?debug3d` hook. `ProductView` passes the props through. (check in the browser on Court 1 Retro:
  - no `.glb` or three chunk requested before a press;
  - the tile and the pill each open 3D; "Photos" and a photo thumbnail go back;
  - with no pick, opening from the Black / Sail photo shows Black / Sail;
  - pressing "Photos" doesn't trigger the context-lost fallback (wait 1 s, then reopen 3D);
  - picking Team Red / White in 3D recolors in place;
  - drag spins, the wheel scrolls the page, and the arrow keys spin;
  - a Wix sample product shows both controls disabled, labelled "3D view not available".)
- [x] 5. **Fallbacks.** Check each in the browser with a JS stub set before pressing 3D. Each must end on photos with the note and disabled controls:
  - `HTMLCanvasElement.prototype.getContext = () => null` (no WebGL);
  - `window.fetch` rejecting `.glb` URLs (load error). three's FileLoader passes a `Request`, so the stub checks `String(input?.url ?? input).includes('.glb')`;
  - `WEBGL_lose_context.loseContext()` on the live canvas (context lost).
- [x] 6. **Analytics.** Add both events and `'model_load'` to the catalog; call them from the gallery (check: `npm run check`; the network panel shows a PostHog capture for `product_3d_opened` with `product_id` and `source`, and one `product_3d_failed` per fallback in step 5).
- [ ] 7. **Styles and design check.** Add the classes above. Screenshot 1440 and 390 in photo mode (unchanged from plan 09), loading, 3D, and the fallback note. Fix differences and repeat (check: screenshots in the report).
- [ ] 8. Verification below, then a reviewer subagent, then close-out.

Each step is committed when its check passes.

## Files

- Create: `src/wix/models/presets.ts`, `src/wix/models/product-models.ts`, `src/components/storefront/ShoeViewer.tsx`, `prompts/11-product-3d-view.md`
- Change: `src/pages/products/[slug].astro`, `src/components/storefront/ProductView.tsx`, `src/components/ui/ProductGallery.tsx`, `src/scripts/analytics.ts`, `src/styles/global.css`, `package.json`, `package-lock.json`, `prompts/README.md`, `AGENTS.md` (close-out, with your OK)

## Acceptance criteria

- WHEN a product has a `ProductModels` row and the shopper presses the 3D pill or the 3D View tile THE SITE SHALL show its model in the photo frame, colored with the preset of the shopper's color pick, or with the preset of the photo in the frame when nothing is picked.
- WHEN the shopper picks another color while in 3D THE SITE SHALL recolor the model without reloading it.
- WHEN the shopper drags or swipes the model THE SITE SHALL spin it, and the mouse wheel SHALL still scroll the page.
- WHEN the shopper presses "Photos" or a photo thumbnail THE SITE SHALL show the photos again.
- WHEN WebGL is unavailable, the model fails to load, loading passes 20 s, or the context is lost THE SITE SHALL show the photos, a note that 3D couldn't load, and disabled 3D controls.
- WHEN a product has no `ProductModels` row THE SITE SHALL show both 3D controls disabled and labelled "3D view not available".
- WHEN a product page loads THE SITE SHALL NOT download three.js or the model until 3D is opened.

## Verification

- `npm run check` and `npm run build` (output shown, with the lazy 3D chunk's size).
- The browser at 1440px and 390px (Chrome; 390px through the same-origin iframe), on Court 1 Retro and Nightshift High (the dark model) and one Wix sample product. Screenshots of photo mode, loading, 3D in both colors and the fallback note.
- The network panel: no `.glb` or 3D chunk before the press; one `.glb` from `static.wixstatic.com` after it; none on a second open.
- The three fallbacks from step 5, each with its screenshot and `product_3d_failed` capture.
- The PostHog captures, seen in the network panel. The PostHog MCP isn't authorized here, so events aren't checked in PostHog itself.
- The color resolution order is checked in the browser (step 4).

## Risks and open questions

- **R3F 8 and drei 9 with three 0.186.** Both are from February 2025 and declare open-ended `three` peers. The review prototype loaded and recolored a model in headless Chrome, but only with SwiftShader, not on real GPUs or Safari. If step 3 shows a render problem, I stop and ask.
- **Bundle size.** The prototype's 3D chunk is 258 KB gzipped, loaded only on a 3D press. The model is 1.9–4.8 MB (Pacer 2 is the largest). The report shows the measured numbers.
- **Server-side `wixFetch`.** It hasn't been used on the server in this repo yet. The kit documents it for both sides under ambient auth. If step 1 fails, I stop and ask; the fallback is reading the row in the browser when 3D opens.
- **Phone gesture.** Swiping on the canvas spins the shoe instead of scrolling. The canvas is short on phones (29vh), so the page stays easy to scroll elsewhere.
- **Fused zones (plan 10).** Nightshift High, Orbit High and Pacer 2 can't show their named accent color, so their 3D view differs from the photo in that detail.
- **Spend:** no Wix AI credits, no paid services. Three new runtime packages and one dev package.

## Result

Filled at close-out.
