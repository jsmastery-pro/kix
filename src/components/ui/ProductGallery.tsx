// The product page's photos and 3D view (plans 09, 11): a thumbnail rail ending in the 3D View tile,
// the main frame with prev/next arrows, an expand lightbox and the 3D pill. One activeIndex into the
// gallery; a color pick (the kit's imageUrl) moves it to the photo with the same media key, so
// thumbnails and arrows keep working after a pick. The 3D tile and pill swap the frame for the lazy
// ShoeViewer, colored by resolvePreset; no WebGL, a load error, a 20 s timeout or a lost context
// fall back to photos and turn 3D off for the visit. The root is display: contents, so the rail and
// the frame are grid items of the page layout (.pdp__top).
import { ChevronLeft, ChevronRight, Images, LoaderCircle, Maximize, Rotate3d, X } from 'lucide-react';
import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { captureError, track } from '../../scripts/analytics';
import { imgAttrs, mediaKey } from '../../wix/media';
import { resolvePreset, type ColorGroup, type ProductModel } from '../../wix/models/presets';

type ShoeViewerType = typeof import('../storefront/ShoeViewer').default;
// Client only: the server build never bundles three.
const ShoeViewer = lazy<ShoeViewerType>(() =>
  import.meta.env.SSR ? Promise.resolve({ default: (() => null) as unknown as ShoeViewerType }) : import('../storefront/ShoeViewer'),
);

interface Props {
  name: string;
  gallery: string[];
  /** The photo for the shopper's color pick (useProductDetail().imageUrl); null before a pick. */
  selectedImage: string | null;
  /** Changes on every color pick, so re-picking the current color shows its photo again. */
  selectionKey: number;
  productId: string;
  /** The ProductModels row; null disables the 3D controls. */
  model: ProductModel | null;
  /** The color option group (selected choice, choice photos); null when the product has none. */
  colors: ColorGroup | null;
}

type Mode = 'photos' | 'loading' | '3d';
type FailReason = 'no_webgl' | 'load_error' | 'timeout' | 'context_lost';

const LOAD_TIMEOUT_MS = 20_000;
const FAILED_NOTE = "3D view couldn't load. Showing photos.";

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** Catches a failed chunk import and a model that won't load. */
class ViewerBoundary extends Component<{ onError: (error: unknown) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function ProductGallery({ name, gallery, selectedImage, selectionKey, productId, model, colors }: Props) {
  const [active, setActive] = useState(0);
  // A picked photo that matches no gallery item; shown until the shopper next moves.
  const [unmatched, setUnmatched] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('photos');
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState('');
  const [spun, setSpun] = useState(false);
  // The photo in the frame when 3D opened: its color shows until the shopper picks one.
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);
  const modeRef = useRef<Mode>('photos');
  modeRef.current = mode;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const total = gallery.length;

  useEffect(() => {
    if (!selectedImage) return;
    const key = mediaKey(selectedImage);
    const index = gallery.findIndex((url) => mediaKey(url) === key);
    if (index >= 0) {
      setActive(index);
      setUnmatched(null);
    } else setUnmatched(selectedImage);
    setNote('');
  }, [selectedImage, selectionKey, gallery]);

  const fail = useCallback((reason: FailReason, error?: unknown) => {
    // The stage is about to unmount: keep keyboard focus in the gallery, on the pill.
    if (frameRef.current?.contains(document.activeElement)) pillRef.current?.focus();
    setMode('photos');
    setFailed(true);
    setNote(FAILED_NOTE);
    track('product_3d_failed', { product_id: productId, reason });
    if (error !== undefined) captureError(error, 'model_load');
  }, [productId]);

  useEffect(() => {
    if (mode !== 'loading') return;
    const timer = setTimeout(() => fail('timeout'), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [mode, fail]);

  const src = unmatched ?? gallery[active] ?? '';
  const viewing3d = mode !== 'photos';
  const available = model !== null && !failed;

  const show = (index: number) => {
    setActive((index + total) % total);
    setUnmatched(null);
    setMode('photos');
    setNote('');
  };
  const open3d = (source: 'pill' | 'thumbnail') => {
    if (!available || viewing3d) return;
    if (!hasWebGL()) return fail('no_webgl');
    setOpenPhoto(src);
    setNote('');
    setMode('loading');
    track('product_3d_opened', { product_id: productId, source });
  };
  const onReady = useCallback(() => setMode((m) => (m === 'loading' ? '3d' : m)), []);
  const onSpin = useCallback(() => setSpun(true), []);
  const onContextLost = useCallback(() => { if (modeRef.current !== 'photos') fail('context_lost'); }, [fail]);
  const onViewerError = useCallback((error: unknown) => fail('load_error', error), [fail]);

  const preset = model ? resolvePreset(model, colors, openPhoto) : null;
  const viewerLabel = `${name} in 3D${preset?.colorName ? `, ${preset.colorName}` : ''}. Drag or use arrow keys to spin.`;
  const offLabel = model ? "3D view isn't available right now" : '3D view not available';

  const alt = unmatched ? `${name}, selected color` : `${name}, photo ${active + 1} of ${total}`;
  const photo = imgAttrs(src, '(min-width: 1024px) 46vw, (min-width: 768px) 48vw, 100vw');

  return (
    <div className="ui-gallery">
      <ul className="ui-gallery__rail" aria-label="Photos">
        {gallery.map((url, index) => (
          <li key={`${index}-${url}`}>
            <button
              type="button"
              className="ui-thumbnail"
              aria-pressed={!viewing3d && !unmatched && index === active}
              aria-label={`Show photo ${index + 1} of ${total}`}
              onClick={() => show(index)}
            >
              <span className="ui-thumbnail__image"><img {...imgAttrs(url, '(min-width: 1024px) 9vw, 72px', 1 / 0.92)} alt="" /></span>
            </button>
          </li>
        ))}
        <li>
          {available ? (
            <button type="button" className="ui-thumbnail ui-thumbnail--3d" aria-pressed={viewing3d} aria-label="Show 3D view" onClick={() => open3d('thumbnail')}>
              <span className="ui-thumbnail__image">
                <Rotate3d aria-hidden="true" />
                <span className="ui-thumbnail__label" aria-hidden="true">3D View</span>
              </span>
            </button>
          ) : (
            <button type="button" className="ui-thumbnail ui-thumbnail--3d ui-soon" aria-disabled="true" aria-label={offLabel} title={offLabel}>
              <span className="ui-thumbnail__image">
                <Rotate3d aria-hidden="true" />
                <span className="ui-thumbnail__label" aria-hidden="true">3D View</span>
              </span>
            </button>
          )}
        </li>
      </ul>

      <div ref={frameRef} className="ui-gallery__frame" data-mode={mode}>
        {'src' in photo ? (
          <img {...photo} loading="eager" alt={viewing3d ? '' : alt} />
        ) : (
          <span className="ui-photo__fallback">Image placeholder</span>
        )}
        {viewing3d && model && (
          <ViewerBoundary onError={onViewerError}>
            <Suspense fallback={null}>
              <ShoeViewer url={model.modelUrl} parts={model.parts} zones={preset?.zones ?? null} label={viewerLabel} onReady={onReady} onSpin={onSpin} onContextLost={onContextLost} />
            </Suspense>
          </ViewerBoundary>
        )}
        {mode === 'loading' && (
          <span className="ui-gallery__loading" role="status">
            <LoaderCircle aria-hidden="true" />Loading 3D…
          </span>
        )}
        {mode === '3d' && !spun && <span className="ui-gallery__hint" aria-hidden="true">Drag to spin</span>}
        <p className="ui-gallery__note" role="status">{note}</p>
        {!viewing3d && 'src' in photo && (
          <button ref={expandRef} type="button" className="ui-icon-button ui-gallery__expand" aria-label="View larger photo" title="View larger photo" onClick={() => dialogRef.current?.showModal()}>
            <Maximize aria-hidden="true" />
          </button>
        )}
        {!viewing3d && total > 1 && (
          <>
            <button type="button" className="ui-icon-button ui-icon-button--round ui-gallery__arrow ui-gallery__arrow--prev" aria-label="Previous photo" title="Previous photo" onClick={() => show(active - 1)}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="ui-icon-button ui-icon-button--round ui-gallery__arrow ui-gallery__arrow--next" aria-label="Next photo" title="Next photo" onClick={() => show(active + 1)}>
              <ChevronRight aria-hidden="true" />
            </button>
          </>
        )}
        {!available ? (
          <button ref={pillRef} type="button" className="ui-gallery__3d ui-soon" aria-disabled="true" aria-label={offLabel} title={offLabel}>
            <Rotate3d aria-hidden="true" />3D
          </button>
        ) : viewing3d ? (
          <button ref={pillRef} type="button" className="ui-gallery__3d" aria-label="Show photos" onClick={() => { setMode('photos'); setNote(''); }}>
            <Images aria-hidden="true" />Photos
          </button>
        ) : (
          <button ref={pillRef} type="button" className="ui-gallery__3d" aria-label="Show 3D view" onClick={() => open3d('pill')}>
            <Rotate3d aria-hidden="true" />3D
          </button>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className="ui-lightbox"
        aria-label={`${name} photo`}
        onClick={(event) => { if (event.target === event.currentTarget) dialogRef.current?.close(); }}
        onClose={() => expandRef.current?.focus()}
      >
        {'src' in photo && <img {...imgAttrs(src, 'min(90vw, 90vh)')} alt={alt} />}
        <button type="button" className="ui-icon-button ui-icon-button--round ui-lightbox__close" aria-label="Close photo" title="Close photo" onClick={() => dialogRef.current?.close()}>
          <X aria-hidden="true" />
        </button>
      </dialog>
    </div>
  );
}
