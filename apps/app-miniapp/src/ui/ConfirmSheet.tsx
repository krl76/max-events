// START_MODULE_CONTRACT
// PURPOSE: One confirmation sheet for every destructive or once-only action — cancel booking, leave a waitlist, daily check-in, delete a post.
// SCOPE: Presentational bottom sheet on the shared app-save-sheet chrome; the caller owns the action and the open state.
// DEPENDS: ./sheet.js (useSheetSwipe), ./theme.css (app-save-sheet-*)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import { useSheetSwipe } from "./sheet";

/**
 * A destructive tap asks once, in the sheet that already exists for post deletion: the safe choice is
 * first and neutral, the dangerous one is last and red. Confirm fires the action; backdrop, swipe-down
 * and the neutral button all dismiss without side effects.
 */
export function ConfirmSheet({ title, confirmLabel, cancelLabel = "Оставить", onConfirm, onClose }: { title: string; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onClose: () => void }) {
  const swipe = useSheetSwipe(onClose);
  return (
    <div className="app-save-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="app-save-sheet-backdrop" aria-label="Закрыть" onClick={onClose} />
      <section className="app-save-sheet-card" style={swipe.style}>
        <div className="app-sheet-grab" aria-hidden="true" {...swipe.grab} />
        <h2 className="app-save-sheet-title">{title}</h2>
        <div className="app-post-delete-actions">
          <button type="button" className="app-post-delete-keep" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className="app-post-delete-confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
