import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ActionIcon } from "../ui/icons";
import { showPhoto } from "../ui/photos";

/** A missing file keeps the frame, not the browser's broken-image glyph. */
function FeedPhoto({ src, className = "app-feed-photo" }: { src: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const href = showPhoto(src) ?? src;
  if (failed) return <span className={`${className} app-feed-photo--missing`} aria-hidden="true" />;
  return <img className={className} src={href} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

/** Swipeable photos. A tap opens them full screen, outside the post. */
export function PhotoGallery({ photos }: { photos: string[] }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  if (photos.length === 0) return null;
  const onScroll = () => {
    const node = scroller.current;
    if (node === null || node.clientWidth === 0) return;
    setIndex(Math.min(photos.length - 1, Math.max(0, Math.round(node.scrollLeft / node.clientWidth))));
  };
  return (
    <>
      <div className="app-feed-carousel">
        <div ref={scroller} className="app-feed-carousel-track" onScroll={onScroll}>
          {photos.map((photo, position) => (
            <button
              key={`${position}-${photo.slice(-12)}`}
              type="button"
              className="app-feed-carousel-slide"
              onClick={() => {
                setIndex(position);
                setOpen(true);
              }}
              aria-label={`Открыть фото ${position + 1} из ${photos.length}`}
            >
              <FeedPhoto src={photo} />
            </button>
          ))}
        </div>
        {photos.length > 1 && (
          <>
            <span className="app-feed-carousel-count">
              {index + 1}/{photos.length}
            </span>
            <div className="app-feed-carousel-dots" aria-hidden="true">
              {photos.map((photo, position) => (
                <span key={`${position}-${photo.slice(-8)}`} className={position === index ? "app-feed-carousel-dot app-feed-carousel-dot--on" : "app-feed-carousel-dot"} />
              ))}
            </div>
          </>
        )}
      </div>
      {open && createPortal(<PhotoLightbox photos={photos} index={index} onClose={() => setOpen(false)} />, document.querySelector(".app-root") ?? document.body)}
    </>
  );
}

function PhotoLightbox({ photos, index, onClose }: { photos: string[]; index: number; onClose: () => void }) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState(index);
  const onScroll = () => {
    const node = scroller.current;
    if (node === null || node.clientWidth === 0) return;
    setAt(Math.min(photos.length - 1, Math.max(0, Math.round(node.scrollLeft / node.clientWidth))));
  };
  return (
    <div className="app-photo-lightbox" role="dialog" aria-modal="true" aria-label="Фото">
      <button type="button" className="app-photo-lightbox-close" aria-label="Закрыть" onClick={onClose}>
        <ActionIcon name="close" size={22} />
      </button>
      <div
        className="app-photo-lightbox-track"
        onScroll={onScroll}
        ref={(node) => {
          scroller.current = node;
          if (node !== null && index > 0 && node.scrollLeft === 0) node.scrollLeft = node.clientWidth * index;
        }}
      >
        {photos.map((photo, position) => (
          <div key={`${position}-${photo.slice(-12)}`} className="app-photo-lightbox-slide">
            <FeedPhoto src={photo} />
          </div>
        ))}
      </div>
      {photos.length > 1 && (
        <span className="app-photo-lightbox-count">
          {at + 1}/{photos.length}
        </span>
      )}
    </div>
  );
}
