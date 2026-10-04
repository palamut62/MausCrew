// In-app replacement for window.confirm. Native dialogs block the renderer,
// ignore the app's theme and read as a browser prompt rather than MausCrew;
// every confirmation goes through <ConfirmHost /> instead.

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** styles the confirm button as destructive */
  danger?: boolean;
}

export interface ConfirmRequest extends ConfirmOptions {
  settle: (ok: boolean) => void;
}

let current: ConfirmRequest | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Resolves true only when the user presses the confirm button. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // A second request supersedes the first rather than stacking dialogs.
  current?.settle(false);
  return new Promise((resolve) => {
    const request: ConfirmRequest = {
      ...options,
      settle: (ok) => {
        if (current !== request) return;
        current = null;
        emit();
        resolve(ok);
      },
    };
    current = request;
    emit();
  });
}

export function subscribeConfirm(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentConfirm(): ConfirmRequest | null {
  return current;
}
