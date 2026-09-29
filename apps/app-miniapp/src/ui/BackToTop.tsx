import { useEffect, useState } from "react";
import { ActionIcon } from "./icons";

/** Arrow that appears after the page has moved down and returns the shell scroller to the top. */
export function BackToTop({ label = "Наверх", place = "tab" }: { label?: string; place?: "tab" | "dock" | "result" }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = document.querySelector(".app-content");
    if (!(el instanceof HTMLElement)) return;
    const onScroll = () => setShow(el.scrollTop > 280);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      className={place === "dock" ? "app-search-topbtn app-search-topbtn--dock" : place === "result" ? "app-search-topbtn app-search-topbtn--result" : "app-search-topbtn"}
      aria-label={label}
      onClick={() => {
        const el = document.querySelector(".app-content");
        if (el instanceof HTMLElement) el.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      <ActionIcon name="up" size={22} />
    </button>
  );
}
