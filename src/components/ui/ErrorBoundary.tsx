// src/components/ui/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import { showWindow } from "../../lib/windowShow";
import AppBand from "./AppBand";
import Button from "./Button";

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * The root of the app: after a render error it shows a plain panel instead of a blank transparent window,
 * with the window buttons and a drag bar (the window has no title bar) and a Reload. It uses no app state
 * or provider, since any of them may be what failed.
 */
class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error", error, info.componentStack);
    // The window starts hidden (see windowShow.ts): an error before the first screen must still show its panel
    showWindow();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="error-boundary">
        <AppBand />
        <div className="error-boundary__card" role="alert">
          <h1 className="error-boundary__title">Something went wrong</h1>
          <p className="error-boundary__text">
            Graphene hit an error and could not keep this window going. Notes
            you saved are safe on your disk; what you typed in the last moment
            may not be.
          </p>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
