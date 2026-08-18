// Keeping a bot's model selection inside what its engine actually serves.
//
// A selection is data on a record, so it can arrive from places the picker
// never touched — the HTTP API, an import, a config written by an older
// build — and a pairing like {instanceId: "claude", model: "deepseek-chat"}
// is only discovered when the CLI rejects the flag and the user reads a raw
// provider error. This pulls that check forward to the two moments that
// matter: when a selection is written, and when a turn is about to run.
//
// The check is deliberately weak. Only a closed catalog (a CLI engine with
// a fixed model list) can call an id wrong; an `extensible` catalog says its
// options are a menu rather than an enumeration, and an unlisted id there is
// a legitimate private build, so it passes untouched.
import type { ModelSelection, ProviderInstance } from "./contracts.ts";

export interface NormalizedSelection {
  selection: ModelSelection;
  changed: boolean;
  /** Set only when changed — user-facing, says what was dropped and why. */
  reason?: string;
}

/** Clamp `selection` to something `instance` can serve. Returns the input
 * untouched (changed = false) whenever there is nothing to say: no such
 * instance, an extensible catalog, or a model already on the menu. */
export function normalizeModelSelection(
  selection: ModelSelection,
  instance: ProviderInstance | null | undefined,
): NormalizedSelection {
  // An unregistered engine declares no catalog, so there is nothing to
  // check against. Leave it alone — startTurn refuses to run on an
  // unavailable instance anyway, and rewriting a selection whose engine is
  // merely offline would lose the user's choice when it comes back.
  if (!instance) return { selection, changed: false };

  const catalog = instance.models;
  if (catalog.extensible) return { selection, changed: false };
  if (catalog.options.some((option) => option.id === selection.model)) return { selection, changed: false };

  const engine = instance.displayName || instance.instanceId;
  return {
    selection: { ...selection, model: catalog.default },
    changed: true,
    reason: `Model "${selection.model}" is not offered by ${engine} — switched to ${catalog.default}.`,
  };
}
