# 12 · Customize in 3D and saved designs

Status: approved

<!-- review → approved → done, or dropped. Only the user approves. -->

**Request:** "When a shoe is shown in 3D on the product page, add a Customize option there where shoppers change the color of each part the model has, starting from the color they picked. Signed in shoppers can save the design to their account and open it again later. Use our design system, since there is no design for this panel."

## Goal

On `/products/<slug>`, once the 3D view (plan 11) is showing, a **Customize** pill sits next to **Photos** in the frame. Pressing it opens a Customize panel in the buy column, under the Color picker. The panel has one chip per zone the model has (upper, sole, laces, accent; for example Nightshift High shows only Upper and Sole). It also has the stock color of the selected zone plus a 16-color Kix palette, Reset, and Save Design. The design starts from the shopper's color pick (the same preset plan 11 shows), and every swatch press recolors the 3D shoe at once. A signed-in shopper saves the design to their account and reopens it later from two places: the panel's "Your designs" list for that shoe, or a Saved Designs card on `/account`. A signed-out shopper who presses Save is sent to sign in and comes back to the same design, still unsaved. Add to Cart keeps adding the stock color, and the panel says so.

## Out of scope

- Carrying the design into the cart or the order (design code on the order line). That belongs to the cart plan. No Wix Stores product changes.
- Any color outside the palette (no color picker), patterns, text or materials.
- Highlighting the selected zone on the model, zoom or pan.
- Naming designs, sharing a design link with someone else, design thumbnails or renders (no canvas snapshots, no Media uploads).
- A `/customize` page (the header link still 404s).
- Release.

## Decisions

- **Panel spot (user): the buy column.** The Customize pill appears in the frame only in `3d` mode (not while loading), beside the Photos pill. The panel renders in the buy column between the Color group and the Size group. Size, Add to Cart and the status line stay where they are. On phones the buy column sits under the frame, so the panel lands just below the shoe.
- **Colors (user): a curated palette of 16, the same for every zone,** plus each zone's **Original** swatch (the base preset's color for that zone), listed first. The palette is shoe color data, not UI styling, so it lives in `src/wix/models/palette.ts` next to the presets (whose hexes already live in CMS), not in `global.css`. *This reads the AGENTS rule "Colors … live only in global.css" as covering UI colors only. Raised here: say so if you'd rather have palette tokens.* Starting values (names and hexes, tuned in step 3 under the viewer's lighting):

  | Name | Hex | Name | Hex |
  | --- | --- | --- | --- |
  | White | `#F4F4F2` | Volt | `#D4F33A` |
  | Sail | `#EDE6D6` | Sage | `#A9BFA0` |
  | Gum | `#B5835A` | Forest | `#2F4F3A` |
  | Wolf Grey | `#A3A6AB` | Sky | `#8EC5E8` |
  | Graphite | `#3C3F44` | Royal | `#2453B8` |
  | Black | `#1F1F1F` | Navy | `#1E365E` |
  | Red | `#C8102E` | Pink | `#F4A6C0` |
  | Orange | `#F2711C` | Grape | `#5B3F8C` |

- **Add to Cart (user): adds the stock color, with a note.** While the panel is open, a line under it reads "Add to Cart adds the stock color. Save your design to keep it." No store data changes.
- **Saved list (user): account and panel.** `/account` gets a Saved Designs card listing every design, and the panel lists this shoe's designs. Open goes to `/products/<slug>?design=<id>`, which opens 3D and the panel with that design.
- **Starting colors.** The panel starts from the preset the 3D view shows: `resolvePreset(model, colors, openPhoto)`, using plan 11's rule (the pick, else the photo's color, else the first preset). `resolvePreset` gains a `choiceId` in its result. The gallery owns `openPhoto`, so it reports the resolved preset (`{ choiceId, colorName, zones }`) to `ProductView` through `onPresetChange`. The Customize pill shows only when a preset resolves. Every preset in all 12 specs covers every zone its model has (checked), so Original always comes from the preset and `ShoeViewer` doesn't change. A zone a future preset leaves out gets no chip.
- **"Customized" means custom colors exist** (`zones !== null` in the design state), whether or not the panel is open. While customized, the gallery shows those colors instead of the preset.
- **A stock color pick while customized starts over** from that color's preset. With the panel open, its status line says "Started over from Black / Sail." With the panel closed, the shoe just shows the new preset. This is the request's "starting from the color they picked", and it keeps the design and the swatches in step. An unsaved change is lost; there is no confirm.
- **Loading a saved design** (panel list, `?design=`, resume) sets the color pick to the design's `baseChoiceId` by calling `d.selectOption` directly. It doesn't go through `select()`, so there's no start-over and no photo jump. Then it sets the design's zones. If `baseChoiceId` is no longer a choice of the product (or isn't available), the pick is left alone, and Original shows the design's own saved colors.
- **Leaving 3D.** Photos (or a photo thumbnail) closes the panel and keeps the custom colors; reopening 3D shows them, and Customize reopens the panel with them. A page reload drops unsaved work.
- **Reset** returns every zone to the base preset (and clears the link to an opened saved design).
- **Saving.** A new design is inserted. After opening a saved design, the main button reads **Save Changes** and updates it, and a text button **Save as New** inserts a copy. No names: the list shows product, base color, the zone dots and the saved date.
- **Signed out.** The button reads **Sign In to Save** and links to `withReturnTo('/login', '/products/<slug>?resume=design')` (encoded; `safeReturnTo` keeps the query, and `@wix/astro`'s callback returns to the full path for email and Google alike). Before navigating, the design goes into `sessionStorage` (`kix-pending-design`: product ID, base choice ID, zones). Back on the product page, `resume=design` with a matching pending design opens 3D and the panel with it, unsaved. The shopper still presses Save. The `resume` param (`history.replaceState`) and the storage key are removed as soon as they're read, whether or not they matched. Every storage call is wrapped in try/catch; without storage, the shopper returns to the plain product page.
- **Member state on the product page** comes from `useMember()` (client read, as the header does), so the page stays cacheable. Until it settles, the Save button shows its busy state.
- **Storage: a `SavedDesigns` Wix CMS site collection,** created by API like `ProductModels`. Members read and write their own items straight from the browser through `wixFetch` (ambient member token), with Wix's own permissions doing the access check. That means no server route and no `auth.elevate()`.
  - Permissions: read `SITE_MEMBER_AUTHOR`, insert `SITE_MEMBER`, update `SITE_MEMBER_AUTHOR`, remove `SITE_MEMBER_AUTHOR`.
  - Fields: `title` TEXT (product name at save time), `productId` TEXT, `productSlug` TEXT, `baseChoiceId` TEXT, `baseColor` TEXT (stock color name), `zones` OBJECT (`{ upper: "#RRGGBB", … }`, only the model's zones). System fields: `_id`, `_owner` (the member), `_createdDate`, `_updatedDate`.
  - Queries also filter on `_owner` = the member's ID, so a mistaken permission change can't widen what a page lists.
  - "Newest first" and the shown "Saved <date>" both use `_updatedDate`, so Save Changes moves a design to the top.
  - Reads right after a write (the panel list after a save, Get after insert) send `consistentRead: true`.
  - Every read is validated (zone keys, `#RRGGBB` hexes, string IDs) before use, because a member can write anything to their own item. An invalid item is skipped and logged.
- **Account card reads on the server** as the member (the page already calls `fetchCurrentMember()`; this is one more sub-request: Query Data Items, limit 50, newest first). A failed read is logged with `console.error` (analytics can't run on the server). The card carries `data-designs-error`, so `saved-designs.ts` reports it with `captureError(…, 'design_list')` in the browser. Delete runs in the browser (`src/scripts/saved-designs.ts`) with a confirm step inside the row ("Delete this design?" Delete / Keep), not a browser dialog.
- **Panel list:** this shoe's designs, up to 6, newest first. It's read in the browser when the panel first opens for a signed-in member, and re-read after a save. Pressing one loads it, marked `aria-pressed`.
- **Deep link `?design=<id>`:** the island reads it after mount and waits until `useMember().loading` is false.
  - **While Get runs,** the frame's note reads "Opening your design…".
  - **Signed in:** Get Data Item. If the item is this product's, the design loads (see Loading a saved design), and 3D and the panel open (`product_3d_opened` source `design`).
  - **Missing, someone else's, or another product's:** the note "This design isn't available."
  - **Signed out:** the buy column's status line reads "Sign in to open this design." with a sign-in link (`withReturnTo`, back to the same `?design=` URL).
  - **No model row:** the note "3D isn't available for this sneaker, so the design can't open."
  - **No WebGL or a 3D failure:** photos with plan 11's note, and Customize stays off.
  - The `design` param is removed (`history.replaceState`) once handled, so a reload shows the plain page rather than undoing edits.
- **UI from the design system:**
  - **Panel:** the `ui-form-card` look (white, `--color-border`, `--radius-lg`, `--ds-panel-shadow`) at a smaller padding, as a new `ui-customize` primitive.
  - **Zone chips:** the `ui-size-option` pill (black outline when `aria-pressed`), each with a 14px dot of the zone's color.
  - **Swatches:** a small `ui-swatch--sm` at `--ds-option-swatch` (32px, the design system's selector size) with a 44px hit area, sharing the selected ring of `ui-swatch`.
  - **Save Design:** the sheet's save-design specimen (`ui-button--quiet ui-button--wide`, Bookmark leading, ChevronRight trailing).
  - **Customize pill:** the existing `ui-gallery__3d` pill with lucide `Palette`.
  - **Icons:** lucide `Palette`, `Bookmark`, `ChevronRight`, `RotateCcw`, `X`, `LoaderCircle`, `Trash2`.
  - No new color tokens.
- **Phone layout (≤ the existing phone breakpoint):**
  - The two frame pills sit centered side by side (`ui-gallery__pills`, gap 8px), each at 44px height.
  - The Customize card is full width with 16px padding (about 326px inside at 390px). The swatches wrap at a 44px pitch, so 7 per row; Original plus 16 makes 3 rows.
  - The phone rule `.ui-swatch { width: 44px; height: 44px }` is restated for `.ui-swatch--sm` (32px) inside the same media query, so it doesn't override the small size.
  - While customized, the frame is `position: sticky; top: 0` (`.pdp__top[data-customizing]`), so the shoe stays in view as the shopper scrolls to the swatches. The sticky Add to Cart bar stays at the bottom. Checked in step 8.
  - Desktop and tablet need no sticky frame, since the panel sits beside the frame.
- **Analytics** (catalog additions, no hexes, names or IDs other than product and Wix codes):
  - `design_customize_opened { product_id }`
  - `design_saved { product_id, kind: 'new' | 'update' }`
  - `design_save_failed { product_id, reason }` (Wix code or `network`)
  - `design_opened { product_id, source: 'panel' | 'account' | 'resume' }`
  - `design_deleted { product_id }`
  - `design_sign_in_prompted { product_id }`
  - `product_3d_opened.source` gains `'design'`.
  - `ErrorArea` gains `design_save`, `design_list`, `design_load` and `design_delete`.
- **Collection setup:** a `setup-designs` subcommand in `scripts/models/models.mjs` (`npm run models -- setup-designs`), reusing its `wix()` token and `api()` helpers rather than copying them. It's idempotent. It runs Get Collection and creates the collection if missing. If the collection exists, it prints the permissions and fields and fails if they differ from this plan. Local only, Node 24.18+.

## Context

- Read: `AGENTS.md`; plans 09, 10, 11 (Decisions and Result); `ProductView.tsx`, `ProductGallery.tsx`, `ShoeViewer.tsx`, `src/wix/models/{presets,product-models}.ts`, `src/pages/products/[slug].astro`, `src/pages/account.astro`, `src/wix/sdk.ts` (`wixFetch`, ambient auth), `member-store.ts`, `useMember.ts`, `members.ts`, `return-to.ts`, `analytics.ts`, `OptionGroup.tsx`, `global.css` (tokens, `ui-swatch`, `ui-size-option`, `ui-form-card`, `ui-gallery__*`), `site.css` (`.pdp*`, `.account*`), `design-system.astro` (Save Design specimen, CUSTOMIZABLE badge), `scripts/models/models.mjs` (`setup`, `wix()` token).
- Wix docs (read for the installed `@wix/sdk` ^1.21 / REST v2):
  - Create Data Collection (`SITE_MEMBER_AUTHOR`, `SITE_MEMBER` roles): https://dev.wix.com/docs/api-reference/business-solutions/cms/collection-management/data-collections/create-data-collection.md
  - Insert `POST /wix-data/v2/items`: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/insert-data-item.md
  - Update `PUT /wix-data/v2/items/{id}`: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/update-data-item.md (replaces the whole payload)
  - Remove `DELETE /wix-data/v2/items/{id}?dataCollectionId=`: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/remove-data-item.md
  - Get `GET /wix-data/v2/items/{id}?dataCollectionId=` (`consistentRead` after a write): https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/get-data-item.md
  - Query `POST /wix-data/v2/items/query` (filter, sort, offset paging): https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items.md
- Builds on plan 10 (`ProductModels`: parts → zones, presets) and plan 11 (`ShoeViewer` recolors from a `zones` prop; the gallery owns the 3D mode). The `ShoeViewer` API already takes arbitrary zone colors, so the viewer itself barely changes.

## Approach

**State owner: `ProductView`.** The gallery and the buy column are siblings in the island, so `ProductView` holds the design state through a small hook, `useDesign` (in `CustomizePanel.tsx`'s module or `src/hooks/storefront/useDesign.ts`):

```
{ open: boolean, base: { choiceId, colorName, zones }, zones: ZoneColors, zone: Zone, savedId: string | null, dirty: boolean }
```

- `ProductGallery` gets new props:
  - `customZones` (`ZoneColors | null`) overrides the preset's zones when set.
  - `panelOpen` (`boolean`) marks the Customize pill `aria-pressed`.
  - `onCustomize()` is called by the pill.
  - `onPresetChange(preset)` reports the resolved preset (see Starting colors).
  - `on3dChange(mode)` lets the panel close when 3D closes.
  - `onNote` / `note`: the deep link's frame notes go through the gallery's existing `ui-gallery__note`.
- The gallery exposes `open3d('design')` to the parent through `useImperativeHandle` (`ProductGalleryHandle`), for the deep link and resume. When `model` is null it returns false, so the caller shows its note.
- `ShoeViewer` doesn't change.

**Data layer: `src/wix/models/designs.ts`** (client-safe; `wixFetch` only):

```ts
export interface SavedDesign { id; productId; productSlug; title; baseChoiceId; baseColor; zones: ZoneColors; savedAt: string }
export function toDesign(item): SavedDesign | null        // validation
export async function listDesigns(memberId, { productId?, limit }): Promise<SavedDesign[]>   // throws on HTTP error
export async function getDesign(id): Promise<SavedDesign | null>   // 404/403 → null
export async function saveDesign(input, id?): Promise<SavedDesign>  // insert or update (full payload)
export async function deleteDesign(id): Promise<void>
```

Errors carry the Wix error code (`details.applicationError.code`) or `network` for analytics. The account page calls `listDesigns` on the server (same module, ambient auth as the member).

**Panel: `src/components/storefront/CustomizePanel.tsx`** (`ui-customize`), top to bottom:

1. Header: `h2` "Customize" (`ui-option-group__label` type), a Reset text button (`RotateCcw`), and a close icon button (`X`, "Close customize").
2. Zone chips (`role="group"`, `aria-label="Part"`): one `ui-size-option ui-zone-option` per model zone in `ZONES` order, each with a `ui-zone-option__dot`. The selected one is `aria-pressed`.
3. Label: "Upper: Navy" (or "Upper: Original").
4. Swatches (`role="group"`, `aria-label="Upper color"`): Original, then the 16 palette colors. Each is a `ui-swatch ui-swatch--sm` with `aria-pressed` and an `aria-label` of the color name. A press sets the zone's color, and the 3D shoe updates the same frame.
5. Save row: the Save Design button (or Sign In to Save link, or Save Changes plus Save as New), busy "Saving…".
6. Status line (`ui-status-line`, `role="status"`). It shows "Saved to your account." with a "See all" link to `/account#saved-designs-title` (the id `FormCard` derives from the title "Saved Designs"), or an error such as "We couldn't save your design. Try again.", or "Started over from …".
7. Note (`ui-customize__note`, text-secondary 14px): "Add to Cart adds the stock color. Save your design to keep it."
8. "Your designs" (signed in, one or more): a list of buttons with zone dots plus "Saved Nov 3", up to 6. While loading it shows two skeleton rows (`ui-skeleton-line`). On error it shows "We couldn't load your designs." with a Retry text button. With none it shows nothing.

Focus: opening the panel moves focus to its heading (`tabIndex=-1`), and closing it returns focus to the Customize pill.

**Account: `src/pages/account.astro`** gains a full-width `FormCard` "Saved Designs" (heading id `saved-designs-title`) below the two cards. Each row shows the product name (a link to Open), base color, zone dots, "Saved <date>", Open (`ui-button--quiet`) and Delete (`Trash2` icon button), with an inline confirm. With no designs: "No saved designs yet." plus a link to `/shop`. If the read fails: "We couldn't load your saved designs. Refresh to try again." Delete removes the row and announces "Design deleted." in a polite live region. A failed delete keeps the row and shows the error.

**New CSS** (`global.css`, primitives; sizes only, existing tokens):
- `ui-customize` (+ `__head`, `__title`, `__zones`, `__swatches`, `__note`, `__list`, `__design`);
- `ui-zone-option` (+ `__dot`);
- `ui-swatch--sm`;
- `ui-design-dots`;
- `ui-gallery__pills` (wraps the two frame pills, so `ui-gallery__3d`'s own `left: 50%` centering moves to the wrapper).

`site.css` gets `.pdp__customize` (margin), `.account__designs` (grid span) and the phone rules.

**Sub-requests:** the product page is unchanged (all design reads run in the browser). The account page goes from 1 to 2.

## Steps

- [x] 1. **Collection and access spike.** Add `setup-designs` to `models.mjs` and run it. Write `designs.ts`. In Chrome on `localhost:4321`, signed in, call insert → query → get → update → remove from the console through the island's module (a temporary `window.__designs` hook in dev, removed after the step). (check: Get Collection prints the four permissions and six fields. As the member, every call returns 2xx and the item's `_owner` equals the member ID. Signed out, insert and query return 403 or empty. **If the member calls fail, stop and ask:** the fallback is a server route with `auth.elevate()`, which this plan didn't approve.)
- [x] 2. **Analytics catalog.** Add the events and error areas above. (check: `npm run check`.)
- [x] 3. **Palette and design state.** Add `palette.ts`, `useDesign`, `resolvePreset`'s `choiceId`, `ProductGallery`'s new props and handle, and the Customize pill (`3d` mode only). Tune the palette hexes in the viewer. (check: on Court 1 Retro, a temporary hard-coded `customZones` turns the upper Royal in 3D, and Photos → 3D keeps it.)
- [ ] 4. **Customize panel.** Add `CustomizePanel.tsx` and the CSS, with chips for the model's zones only, Original + palette, Reset, close, the note, starting from the pick, and a color pick starting over. (check: in Chrome, Court 1 Retro shows 4 chips, Nightshift High 2, Tempo Run 3. Each swatch recolors the right parts. Reset restores the preset. Picking Black / Sail restarts and announces it. Keyboard: Tab reaches every chip and swatch, with visible focus.)
- [ ] 5. **Save and sign-in.** Add the Save Design flow (new, Save Changes, Save as New), Sign In to Save with `sessionStorage` and `?resume=design`, and the error state. (check: signed in, save → a row in `SavedDesigns` with the right fields, and "Saved to your account." Signed out → `/login?returnTo=…resume=design` → after sign-in, 3D and the panel reopen with the same colors, and the URL is clean. A forced failure (blocked `wixapis.com/wix-data`) shows the error and fires `design_save_failed`.)
- [ ] 6. **Your designs and deep link.** Add the panel list and `?design=<id>`. (check: the list shows the saved design, and pressing it loads its colors. `?design=<id>` opens 3D and the panel with it. A bad ID, another product's ID and a signed-out visit each show their note.)
- [ ] 7. **Account card.** Add the server list, Open, Delete with inline confirm, and the empty and error states. (check: `/account` lists the designs newest first. Open lands on the product with the design loaded. Delete removes the item in Wix and the row. A forced read error shows the error text, and with no designs the empty state shows.)
- [ ] 8. **Layouts and design-system match.** Compare in Claude in Chrome at 1440px and 390px (390 through a same-origin iframe) against the design system sheet's primitives, since there's no page design. List every difference, fix it, and repeat. (check: screenshots of the product page (3D + panel, signed in and out) and `/account` at both widths; no horizontal overflow at 390; tap targets ≥ 44px.)
- [ ] 9. **Checks.** `npm run check` and `npm run build`. (check: 0 errors, build Complete, and `dist/server` doesn't contain three.)
- [ ] 10. **Review.** A reviewer subagent compares the work with this plan; fix real gaps.
- [ ] 11. **Close out.** Write Result, set `Status: done`, update the index, and propose AGENTS.md edits ("Who owns what": `SavedDesigns`; Commands: `setup-designs`).

Each step is committed when its check passes.

## Files

- Create: `src/wix/models/designs.ts`, `src/wix/models/palette.ts`, `src/components/storefront/CustomizePanel.tsx`, `src/hooks/storefront/useDesign.ts`, `src/scripts/saved-designs.ts`.
- Change: `scripts/models/models.mjs` (`setup-designs`), `src/components/storefront/ProductView.tsx`, `src/components/ui/ProductGallery.tsx`, `src/wix/models/presets.ts` (`choiceId` in `resolvePreset`, a `modelZones(model)` helper), `src/scripts/analytics.ts`, `src/pages/account.astro`, `src/styles/global.css`, `src/styles/site.css`, `prompts/README.md`; `AGENTS.md` at close-out after you OK the edits.
- Wix: new site collection `SavedDesigns` (empty until shoppers save).

## Acceptance criteria

- WHEN the 3D view is showing THE SITE SHALL show a Customize pill next to Photos, and SHALL NOT show it on photos, while loading, or when 3D is unavailable.
- WHEN the shopper presses Customize THE SITE SHALL open the Customize panel in the buy column with one chip per zone the product's model has, starting from the colors shown in 3D.
- WHEN the shopper presses a swatch THE SITE SHALL recolor that zone of the 3D shoe and mark the swatch pressed.
- WHEN the shopper picks a stock color while customizing THE SITE SHALL restart the design from that color's preset and announce it.
- WHEN a signed-in shopper presses Save Design THE SITE SHALL store the design in `SavedDesigns` under their member ID and confirm it.
- WHEN a signed-out shopper presses Sign In to Save THE SITE SHALL send them to sign in and, on return, show the same design unsaved in 3D.
- WHEN a signed-in shopper opens `/account` THE SITE SHALL list only their own saved designs, newest first, with Open and Delete.
- WHEN a shopper opens `/products/<slug>?design=<id>` for their own design of that product THE SITE SHALL open 3D and the panel with that design.
- WHEN a design can't be saved, listed, opened or deleted THE SITE SHALL say so in place, keep the shopper's colors, and log it with `captureError`.
- WHEN the panel is open THE SITE SHALL tell the shopper that Add to Cart adds the stock color.

## Verification

- `npm run check` and `npm run build` output.
- `npm run models -- setup-designs` output (permissions and fields).
- Chrome on `localhost:4321` (Court 1 Retro, Nightshift High, Tempo Run):
  - screenshots at 1440 and 390 of 3D + panel signed in, 3D + panel signed out, the panel's list, `/account` with designs, empty and error;
  - the Wix item JSON after save, update and delete;
  - the PostHog debug log (or a `posthog.capture` spy if the MCP stays unauthorized) for each new event, showing only the catalog properties.
- Forced failures (temporary edits, reverted): save, list, load and delete errors; `?design=` bad, foreign and signed out; no WebGL with `?design=`.
- Report which values were estimated (palette hexes, panel spacing) since there's no design.

## Risks and open questions

- **Member writes from the browser under ambient auth are untested here.** Step 1 proves them before anything else. If Wix rejects them, the fallback (a server route with `elevate()` after checking the member) needs your OK.
- **Cross-member isolation** can only be fully shown with two member accounts. Email signup is blocked by reCAPTCHA (plan 05). With one account, step 1 checks signed-out access and the `_owner` filter. A second account (Google) would let me check that one member can't read another's designs. I'll ask during step 1 if you have one.
- **Abuse:** any member can insert many items into their own designs. There's no server-side cap. CMS item limits depend on the Wix plan. Acceptable for now; a cap would need a server route.
- **Unsaved work** is lost on reload or on a stock color pick (by design, no confirm).
- No Wix AI credits or money spent. One new CMS collection.

## Result

Filled at close-out.
