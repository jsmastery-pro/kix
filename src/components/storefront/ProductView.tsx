// The product page's island (plan 09): gallery and buy column on the kit's useProductDetail, which
// owns selection, variant resolution, availability and the add. Our pickers, not the kit's
// OptionPicker, which doesn't match the design. Add to Cart keeps the design's black: while the hook
// can't add, it is aria-disabled, the kit's reason shows under it, and a press moves focus to the
// first option with no pick. The add confirms inline; the header bag shows the new count. In 3D, the
// Customize panel (plan 12) sits under the Color picker; this island owns the design, its saves and
// the ?design= / ?resume=design links, since the gallery and the buy column are siblings.
import { Heart, LoaderCircle, ShoppingBag } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMember } from '../../hooks/members/useMember';
import { storePendingDesign, takePendingDesign, useDesign, type LoadableDesign } from '../../hooks/storefront/useDesign';
import { useProductDetail } from '../../hooks/storefront/useProductDetail';
import { captureError, track } from '../../scripts/analytics';
import { withReturnTo } from '../../scripts/return-to';
import { DesignError, getDesign, listDesigns, saveDesign, toZones, type SavedDesign } from '../../wix/models/designs';
import { modelZones, type Preset, type ProductModel, type ZoneColors } from '../../wix/models/presets';
import type { ProductDetail } from '../../wix/storefront/types';
import OptionGroup from '../ui/OptionGroup';
import CustomizePanel, { type ListState, type SaveState, type Status } from './CustomizePanel';
import ProductGallery, { type Mode, type ProductGalleryHandle } from '../ui/ProductGallery';

interface Props {
  initial: ProductDetail;
  /** "Men's Shoe"; null hides it. */
  eyebrow: string | null;
  /** The description's first paragraph (merchant HTML). */
  summaryHtml: string | null;
  /** The product's ProductModels row (plan 11); null disables the 3D view. */
  model: ProductModel | null;
}

type Outcome = { tone: 'done' | 'error'; text: string; link?: { href: string; label: string } } | null;

const reasonOf = (error: unknown) => (error instanceof DesignError ? error.reason : 'unknown');

export default function ProductView({ initial, eyebrow, summaryHtml, model }: Props) {
  const d = useProductDetail({ initial });
  const [outcome, setOutcome] = useState<Outcome>(null);
  // Counts color picks, so picking the current color again brings its photo back.
  const [colorPicks, setColorPicks] = useState(0);
  const buyRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<ProductGalleryHandle>(null);
  // The preset the 3D view resolves (the gallery owns the photo it falls back to).
  const [preset, setPreset] = useState<Preset | null>(null);
  const zonesOnModel = useMemo(() => (model ? modelZones(model) : []), [model]);
  const design = useDesign(preset, zonesOnModel);
  const { closePanel } = design;
  const on3dChange = useCallback((mode: Mode) => { if (mode === 'photos') closePanel(); }, [closePanel]);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [designStatus, setDesignStatus] = useState<Status | null>(null);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<ListState>({ kind: 'hidden' });
  const member = useMember();
  const memberId = member.member?.id ?? null;
  const product = d.product ?? initial;
  const blocked = !d.canAdd || d.adding;
  const colorGroup = d.optionGroups.find((g) => g.isColor) ?? null;
  const path = `/products/${product.slug}`;

  const select = (optionId: string, choiceId: string) => {
    setOutcome(null);
    if (d.optionGroups.find((g) => g.id === optionId)?.isColor) {
      setColorPicks((n) => n + 1);
      // A stock color pick starts the design over from that color's preset.
      if (design.override) {
        design.startOver();
        const name = colorGroup?.choices.find((c) => c.choiceId === choiceId)?.name;
        if (design.open && name) setDesignStatus({ text: `Started over from ${name}.` });
      }
    }
    d.selectOption(optionId, choiceId);
  };

  const openCustomize = () => {
    setDesignStatus(null);
    design.openPanel();
    track('design_customize_opened', { product_id: product.id });
  };
  const closeCustomize = () => {
    design.closePanel();
    document.getElementById('pdp-customize-pill')?.focus();
  };
  useEffect(() => {
    if (design.open) headingRef.current?.focus();
  }, [design.open]);

  /** Shows a design: picks its stock color when the product still offers it, else keeps its own colors as Original. */
  const applyDesign = (loaded: LoadableDesign) => {
    const choice = colorGroup?.choices.find((c) => c.choiceId === loaded.baseChoiceId);
    const pickable = Boolean(colorGroup && choice && model?.presets.some((p) => p.choiceId === loaded.baseChoiceId));
    if (pickable && colorGroup && !choice!.selected) d.selectOption(colorGroup.id, loaded.baseChoiceId);
    setDesignStatus(null);
    design.load(loaded, !pickable);
  };

  /** Only the model's zones, so a design never stores a part the shoe doesn't have. */
  const savedZones = (colors: ZoneColors): ZoneColors => Object.fromEntries(zonesOnModel.filter((z) => colors[z]).map((z) => [z, colors[z]]));

  const loadList = useCallback(async (fresh = false) => {
    if (!memberId) return;
    setList((current) => (current.kind === 'ready' ? current : { kind: 'loading' }));
    try {
      setList({ kind: 'ready', designs: await listDesigns(memberId, { productId: product.id, limit: 6, fresh }) });
    } catch (error) {
      captureError(error, 'design_list');
      setList({ kind: 'error' });
    }
  }, [memberId, product.id]);
  useEffect(() => {
    if (design.open && memberId && list.kind === 'hidden') void loadList();
  }, [design.open, memberId, list.kind, loadList]);

  async function save(asNew: boolean) {
    if (!memberId || !design.base || !design.shown || saving) return;
    const kind = design.savedId && !asNew ? 'update' : 'new';
    setSaving(true);
    setDesignStatus(null);
    try {
      const saved = await saveDesign(
        { title: product.name, productId: product.id, productSlug: product.slug, baseChoiceId: design.base.choiceId, baseColor: design.base.colorName, zones: savedZones(design.shown) },
        kind === 'update' ? design.savedId! : undefined,
      );
      design.saved(saved.id);
      track('design_saved', { product_id: product.id, kind });
      setDesignStatus({ tone: 'done', text: 'Saved to your account.', link: { href: '/account#saved-designs-title', label: 'See all' } });
      void loadList(true);
    } catch (error) {
      captureError(error, 'design_save');
      track('design_save_failed', { product_id: product.id, reason: reasonOf(error) });
      setDesignStatus({ tone: 'error', text: "We couldn't save your design. Try again." });
    } finally {
      setSaving(false);
    }
  }

  const signInToSave = () => {
    if (design.base && design.shown) {
      storePendingDesign({ productId: product.id, baseChoiceId: design.base.choiceId, baseColor: design.base.colorName, zones: savedZones(design.shown) });
    }
    track('design_sign_in_prompted', { product_id: product.id });
  };

  const openSaved = (saved: SavedDesign) => {
    applyDesign(saved);
    track('design_opened', { product_id: product.id, source: 'panel' });
  };

  // ?resume=design (back from Sign In to Save) and ?design=<id> (Open on /account), once the member
  // session has settled. Both params leave the URL as soon as they're read.
  const linkHandled = useRef(false);
  useEffect(() => {
    if (linkHandled.current || member.loading) return;
    linkHandled.current = true;
    const params = new URLSearchParams(location.search);
    const resume = params.get('resume');
    const designId = params.get('design');
    if (!resume && !designId) return;
    params.delete('resume');
    params.delete('design');
    const query = params.toString();
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
    const gallery = galleryRef.current;

    if (resume === 'design') {
      const pending = takePendingDesign(product.id);
      const zones = pending && toZones(pending.zones);
      if (pending && zones && gallery?.open3d()) {
        applyDesign({ ...pending, zones, id: undefined });
        track('design_opened', { product_id: product.id, source: 'resume' });
      }
      return;
    }
    if (!designId || !gallery) return;
    if (!memberId) {
      setOutcome({ tone: 'error', text: 'Sign in to open this design.', link: { href: withReturnTo('/login', `${path}?design=${encodeURIComponent(designId)}`), label: 'Sign in' } });
      return;
    }
    if (!model) {
      gallery.showNote("3D isn't available for this sneaker, so the design can't open.");
      return;
    }
    galleryRef.current?.showNote('Opening your design…');
    void (async () => {
      try {
        const found = await getDesign(designId);
        // The handle is rebuilt each render: read it fresh after the await.
        const current = galleryRef.current;
        if (!current) return;
        if (!found || found.productId !== product.id) return current.showNote("This design isn't available.");
        current.showNote('');
        if (!current.open3d()) return;
        applyDesign(found);
        track('design_opened', { product_id: product.id, source: 'account' });
      } catch (error) {
        captureError(error, 'design_load');
        galleryRef.current?.showNote("We couldn't open your design. Refresh to try again.");
      }
    })();
  }, [member.loading]); // runs once, when the session settles

  const saveState: SaveState = member.loading
    ? { kind: 'checking' }
    : memberId
      ? { kind: 'signed_in', editing: design.savedId !== null, busy: saving }
      : { kind: 'signed_out', href: withReturnTo('/login', `${path}?resume=design`) };

  const panel = design.open && design.zone && design.base && design.shown ? (
    <CustomizePanel
      id="pdp-customize"
      headingRef={headingRef}
      zones={zonesOnModel}
      zone={design.zone}
      shown={design.shown}
      original={design.base.zones}
      save={saveState}
      list={memberId ? list : { kind: 'hidden' }}
      presetZones={(choiceId) => model?.presets.find((preset) => preset.choiceId === choiceId)?.zones}
      activeId={design.savedId}
      status={designStatus}
      onZone={design.selectZone}
      onPick={design.pick}
      onReset={() => { design.reset(); setDesignStatus(null); }}
      onClose={closeCustomize}
      onSave={(asNew) => void save(asNew)}
      onSignIn={signInToSave}
      onOpenDesign={openSaved}
      onRetryList={() => void loadList()}
    />
  ) : null;

  async function addToCart() {
    if (d.adding) return;
    if (!d.canAdd) {
      const missing = d.optionGroups.find((g) => !g.choices.some((c) => c.selected));
      const target = missing && buyRef.current?.querySelector<HTMLButtonElement>(`[data-option-group="${missing.id}"] button:not(:disabled)`);
      if (target) {
        target.scrollIntoView({ block: 'center' });
        target.focus({ preventScroll: true });
      }
      return;
    }
    setOutcome(null);
    try {
      await d.add();
      track('product_added_to_cart', { product_id: product.id });
      setOutcome({ tone: 'done', text: 'Added to your bag.' });
    } catch (error) {
      captureError(error, 'cart_add');
      setOutcome({ tone: 'error', text: "We couldn't add this to your bag. Try again." });
    }
  }

  const lowStock = d.remaining !== null && d.remaining > 0 && d.remaining <= 10 && !d.isPreorder ? `Only ${d.remaining} left` : null;
  const guidance = !d.canAdd ? d.blockedReason : d.isPreorder ? d.preorderMessage : lowStock;
  const statusText = outcome?.text ?? guidance ?? '';
  const statusTone = outcome ? ` ui-status-line--${outcome.tone}` : '';

  return (
    <div className="pdp__top" data-customizing={design.open || undefined}>
      <ProductGallery
        name={product.name}
        gallery={product.gallery}
        selectedImage={d.imageUrl}
        selectionKey={colorPicks}
        productId={product.id}
        model={model}
        colors={d.optionGroups.find((g) => g.isColor) ?? null}
        customZones={design.override}
        panelOpen={design.open}
        onCustomize={design.open ? closeCustomize : openCustomize}
        onPresetChange={setPreset}
        on3dChange={on3dChange}
        ref={galleryRef}
      />

      <div ref={buyRef} className="pdp__buy">
        {eyebrow && <p className="ui-pdp-eyebrow">{eyebrow}</p>}
        <h1 className="ui-pdp-title pdp__title">{product.name}</h1>
        <div className="ui-price pdp__price">
          <span className="ui-price__now">{d.price}</span>
          {d.compareAtPrice && <s className="ui-price__was"><span className="sr-only">Was </span>{d.compareAtPrice}</s>}
          {d.pricePerUnit && <span className="ui-price__unit">{d.pricePerUnit}</span>}
          {product.ribbons.length > 0 && (
            <span className="ui-price__badges">
              {product.ribbons.map((ribbon) => <span key={ribbon} className="ui-badge ui-badge--sale">{ribbon}</span>)}
            </span>
          )}
          {product.discountNames.length > 0 && <p className="ui-price__note">{product.discountNames.join(' · ')}</p>}
        </div>
        {summaryHtml && <div className="ui-pdp-summary pdp__summary" dangerouslySetInnerHTML={{ __html: summaryHtml }} />}

        {d.optionGroups.map((group) => (
          <Fragment key={group.id}>
            <OptionGroup group={group} onSelect={select} className={group.isColor ? 'pdp__color' : 'pdp__size'} />
            {group.isColor && panel}
          </Fragment>
        ))}
        {!colorGroup && panel}

        <div className="pdp__buy-action">
        <div className="ui-buy-row">
          <button
            type="button"
            className="ui-button ui-button--primary ui-buy-row__cta"
            aria-disabled={blocked}
            aria-busy={d.adding}
            aria-describedby="pdp-status"
            onClick={addToCart}
          >
            <LoaderCircle className="ui-button__spinner" aria-hidden="true" />
            {!d.adding && <ShoppingBag aria-hidden="true" />}
            {d.adding ? 'Adding…' : d.isPreorder ? 'Pre-order' : 'Add to Cart'}
          </button>
          <button type="button" className="ui-icon-button ui-buy-row__wish ui-soon" aria-disabled="true" aria-label="Wishlist coming soon" title="Wishlist coming soon">
            <Heart aria-hidden="true" />
          </button>
        </div>
        <p id="pdp-status" className={`ui-status-line pdp__status${statusTone}`} role="status">
          {statusText}
          {outcome?.link && <> <a href={outcome.link.href}>{outcome.link.label}</a></>}
        </p>
        </div>
      </div>
    </div>
  );
}
