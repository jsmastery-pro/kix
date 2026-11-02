// The product page's photos (plan 09): a thumbnail rail ending in the disabled 3D View tile, the
// main photo with prev/next arrows, an expand lightbox and the disabled 3D pill. One activeIndex
// into the gallery; a color pick (the kit's imageUrl) moves it to the photo with the same media key,
// so thumbnails and arrows keep working after a pick. The root is display: contents, so the rail and
// the frame are grid items of the page layout (.pdp__top).
import { ChevronLeft, ChevronRight, Maximize, Rotate3d, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { imgAttrs, mediaKey } from '../../wix/media';

interface Props {
  name: string;
  gallery: string[];
  /** The photo for the shopper's color pick (useProductDetail().imageUrl); null before a pick. */
  selectedImage: string | null;
  /** Changes on every color pick, so re-picking the current color shows its photo again. */
  selectionKey: number;
}

const SOON = '3D view coming soon';

export default function ProductGallery({ name, gallery, selectedImage, selectionKey }: Props) {
  const [active, setActive] = useState(0);
  // A picked photo that matches no gallery item; shown until the shopper next moves.
  const [unmatched, setUnmatched] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const total = gallery.length;

  useEffect(() => {
    if (!selectedImage) return;
    const key = mediaKey(selectedImage);
    const index = gallery.findIndex((url) => mediaKey(url) === key);
    if (index >= 0) {
      setActive(index);
      setUnmatched(null);
    } else setUnmatched(selectedImage);
  }, [selectedImage, selectionKey, gallery]);

  const show = (index: number) => {
    setActive((index + total) % total);
    setUnmatched(null);
  };
  const src = unmatched ?? gallery[active] ?? '';
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
              aria-pressed={!unmatched && index === active}
              aria-label={`Show photo ${index + 1} of ${total}`}
              onClick={() => show(index)}
            >
              <span className="ui-thumbnail__image"><img {...imgAttrs(url, '(min-width: 1024px) 9vw, 72px', 1 / 0.92)} alt="" /></span>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="ui-thumbnail ui-thumbnail--3d ui-soon" aria-disabled="true" aria-label="3D view, coming soon" title={SOON}>
            <span className="ui-thumbnail__image">
              <Rotate3d aria-hidden="true" />
              <span className="ui-thumbnail__label" aria-hidden="true">3D View</span>
            </span>
          </button>
        </li>
      </ul>

      <div className="ui-gallery__frame">
        {'src' in photo ? (
          <img {...photo} loading="eager" alt={alt} />
        ) : (
          <span className="ui-photo__fallback">Image placeholder</span>
        )}
        {'src' in photo && (
          <button ref={expandRef} type="button" className="ui-icon-button ui-gallery__expand" aria-label="View larger photo" title="View larger photo" onClick={() => dialogRef.current?.showModal()}>
            <Maximize aria-hidden="true" />
          </button>
        )}
        {total > 1 && (
          <>
            <button type="button" className="ui-icon-button ui-icon-button--round ui-gallery__arrow ui-gallery__arrow--prev" aria-label="Previous photo" title="Previous photo" onClick={() => show(active - 1)}>
              <ChevronLeft aria-hidden="true" />
            </button>
            <button type="button" className="ui-icon-button ui-icon-button--round ui-gallery__arrow ui-gallery__arrow--next" aria-label="Next photo" title="Next photo" onClick={() => show(active + 1)}>
              <ChevronRight aria-hidden="true" />
            </button>
          </>
        )}
        <button type="button" className="ui-gallery__3d ui-soon" aria-disabled="true" aria-label="3D view, coming soon" title={SOON}>
          <Rotate3d aria-hidden="true" />3D
        </button>
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
