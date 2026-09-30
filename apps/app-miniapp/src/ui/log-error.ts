// START_MODULE_CONTRACT
// PURPOSE: One place that prints runtime failures so a white screen still leaves a trace in the webview console.
// SCOPE: logError + describeError + installErrorLogging (window error / unhandledrejection). No network reporter.
// DEPENDS: —
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - describeError - Error.message, otherwise a short string
// - logError - console.error with a stable label so the MAX webview log is searchable
// - installErrorLogging - window error and unhandledrejection
// END_MODULE_MAP

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as { message: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Zod-like issue lists and Nest bodies show up here so a failed parse is not just «invalid payload». */
export function describeParseError(error: unknown): string {
  if (error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues: unknown }).issues)) {
    const issues = (error as { issues: Array<{ path?: unknown; message?: unknown }> }).issues;
    return issues
      .slice(0, 8)
      .map((issue) => {
        const path = Array.isArray(issue.path) ? issue.path.join(".") : "";
        const message = typeof issue.message === "string" ? issue.message : "invalid";
        return path ? `${path}: ${message}` : message;
      })
      .join("; ");
  }
  return describeError(error);
}

export function logError(label: string, error?: unknown, extra?: Record<string, unknown>): void {
  if (extra === undefined) console.error(label, describeError(error ?? label));
  else console.error(label, describeError(error ?? label), extra);
}

export function installErrorLogging(target: Window = window): () => void {
  const onError = (event: ErrorEvent) => {
    logError("window error", event.error ?? event.message, { source: event.filename, line: event.lineno });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    logError("unhandled rejection", event.reason);
  };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
