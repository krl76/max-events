// START_MODULE_CONTRACT
// PURPOSE: Keep a crashed route from wiping the mini-app so the tab bar stays and the user can reload.
// SCOPE: Class boundary only. Screens pass children; the fallback reloads the document.
// DEPENDS: ./primitives.js (AppState)
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT

import { Component, Fragment, type ReactNode } from "react";
import { AppState } from "./primitives";

/**
 * A crashed screen used to unmount the whole mini-app: the MAX webview stayed white
 * until the process was killed. This boundary keeps the tab bar and remounts the
 * screen on «Повторить» without reloading the document.
 */
export class ScreenErrorBoundary extends Component<{ children: ReactNode; label?: string }, { failed: boolean; epoch: number }> {
  state = { failed: false, epoch: 0 };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }): void {
    console.error(this.props.label ?? "screen crashed", error.message, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) {
      return <Fragment key={this.state.epoch}>{this.props.children}</Fragment>;
    }
    return (
      <AppState
        action={{
          label: "Повторить",
          onClick: () => this.setState((current) => ({ failed: false, epoch: current.epoch + 1 })),
        }}
      >
        Не удалось открыть экран.
      </AppState>
    );
  }
}
