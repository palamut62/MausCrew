/** Clamp `selection` to something `instance` can serve. Returns the input
 * untouched (changed = false) whenever there is nothing to say: no such
 * instance, an extensible catalog, or a model already on the menu. */
export function normalizeModelSelection(selection, instance) {
    // An unregistered engine declares no catalog, so there is nothing to
    // check against. Leave it alone — startTurn refuses to run on an
    // unavailable instance anyway, and rewriting a selection whose engine is
    // merely offline would lose the user's choice when it comes back.
    if (!instance)
        return { selection, changed: false };
    const catalog = instance.models;
    if (catalog.extensible)
        return { selection, changed: false };
    if (catalog.options.some((option) => option.id === selection.model))
        return { selection, changed: false };
    const engine = instance.displayName || instance.instanceId;
    return {
        selection: { ...selection, model: catalog.default },
        changed: true,
        reason: `Model "${selection.model}" is not offered by ${engine} — switched to ${catalog.default}.`,
    };
}
