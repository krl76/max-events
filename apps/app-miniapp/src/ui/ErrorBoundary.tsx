// START_MODULE_CONTRACT
// PURPOSE: Keep a crashed route from wiping the mini-app so the tab bar stays and the user can retry.
// SCOPE: Class boundary only. Screens pass children. Stale Vite chunks reload the document once; other errors remount.
// DEPENDS: ./primitives.js (AppState), ./chunk-load.js
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import { Component, Fragment, type ReactNode } from "react";
import { isStaleChunkError, recoverFromStaleChunk } from "./chunk-load";
import { AppState } from "./primitives";

/**
 * A crashed screen used to unmount the whole mini-app: the MAX webview stayed white
 * until the process was killed. This boundary keeps the tab bar. After a deploy the
 * webview still holds old chunk hashes; remounting reuses the failed import, so those
 * errors reload the document once. Other errors remount on «Повторить».
 */
export class ScreenErrorBoundary extends Component<
  { children: ReactNode; label?: string; quiet?: boolean },
  { failed: boolean; epoch: number; staleChunk: boolean }
> {
  state = { failed: false, epoch: 0, staleChunk: false };

  static getDerivedStateFromError(error: Error): { failed: boolean; staleChunk: boolean } {
    return { failed: true, staleChunk: isStaleChunkError(error) };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    console.error(this.props.label ?? "screen crashed", error.message, info.componentStack);
    if (isStaleChunkError(error)) recoverFromStaleChunk();
  }

  render(): ReactNode {
    if (!this.state.failed) {
      return <Fragment key={this.state.epoch}>{this.props.children}</Fragment>;
    }
    if (this.props.quiet) return null;
    return (
      <AppState
        action={{
          label: "Повторить",
          onClick: () => {
            if (this.state.staleChunk) {
              window.location.reload();
              return;
            }
            this.setState((current) => ({ failed: false, epoch: current.epoch + 1, staleChunk: false }));
          },
        }}
      >
        Не удалось открыть экран.
      </AppState>
    );
  }
}
