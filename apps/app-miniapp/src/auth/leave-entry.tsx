import { createContext, useContext, type ReactNode } from "react";

const LeaveEntryContext = createContext<(() => void) | null>(null);

export function LeaveEntryProvider({ onLeave, children }: { onLeave: () => void; children: ReactNode }) {
  return <LeaveEntryContext.Provider value={onLeave}>{children}</LeaveEntryContext.Provider>;
}

/** Returns to the MAX / organizer chooser. Null outside that shell, so settings can render alone. */
export function useLeaveEntry(): (() => void) | null {
  return useContext(LeaveEntryContext);
}
