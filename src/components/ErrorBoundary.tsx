import { Component, type ErrorInfo, type ReactNode } from "react";

/** Last line of defence for a render error or a lazy chunk that failed to
 * load: without it React unmounts the whole tree and leaves a blank window. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ui crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="flex h-full items-center justify-center bg-app p-6">
        <div className="w-full max-w-[460px] rounded-xl border border-hairline bg-card p-5">
          <div className="text-[15px] font-semibold text-ink">MausCrew hit a display error</div>
          <div className="mt-1.5 text-[12.5px] leading-relaxed text-ink-secondary">
            Your bots, tasks and running work live in the background service and are not affected. Reload the window to continue.
          </div>
          <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-raised/60 px-3 py-2 text-[11px] text-ink-secondary">
            {this.state.error.message}
          </pre>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-accent px-3 py-2 text-[12px] font-semibold text-app hover:brightness-110"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
