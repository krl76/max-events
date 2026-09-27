import { useRef, useState } from "react";
import { ActionIcon } from "../ui/icons";

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
            <button key={`${position}-${photo.slice(-12)}`} type="button" className="app-feed-carousel-slide" onClick={() => { setIndex(position); setOpen(true); }} aria-label={`Открыть фото ${position + 1} из ${photos.length}`}>
              <img className="app-feed-photo" src={photo} alt="" />
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
      {open && <PhotoLightbox photos={photos} index={index} onClose={() => setOpen(false)} />}
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
            <img src={photo} alt="" />
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
