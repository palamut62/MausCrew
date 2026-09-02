// Browser KeyboardEvent → the X keysym the box's xdotool understands.
//
// Only what a person actually needs while finishing a sign-in by hand: the
// characters they type, the keys that submit and correct, and the modifier
// combos a form uses. Anything else returns null and is left to the browser,
// which is the safe default — an unrecognised chord must not silently become
// a different keystroke on the remote screen.
export interface KeyEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

/** Keys whose X name differs from the browser's. */
const NAMED: Record<string, string> = {
  Enter: "Return",
  Backspace: "BackSpace",
  Escape: "Escape",
  Tab: "Tab",
  Delete: "Delete",
  Home: "Home",
  End: "End",
  PageUp: "Prior",
  PageDown: "Next",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  " ": "space",
};

/** Printable characters xdotool takes by name rather than literally. */
const PUNCTUATION: Record<string, string> = {
  "!": "exclam",
  '"': "quotedbl",
  "#": "numbersign",
  $: "dollar",
  "%": "percent",
  "&": "ampersand",
  "'": "apostrophe",
  "(": "parenleft",
  ")": "parenright",
  "*": "asterisk",
  "+": "plus",
  ",": "comma",
  "-": "minus",
  ".": "period",
  "/": "slash",
  ":": "colon",
  ";": "semicolon",
  "<": "less",
  "=": "equal",
  ">": "greater",
  "?": "question",
  "@": "at",
  "[": "bracketleft",
  "\\": "backslash",
  "]": "bracketright",
  "^": "asciicircum",
  _: "underscore",
  "`": "grave",
  "{": "braceleft",
  "|": "bar",
  "}": "braceright",
  "~": "asciitilde",
};

/**
 * The `{kind:"key"}` body for this event, or null to let the browser have it.
 *
 * Modifiers are carried as an xdotool chord (`ctrl+c`). Cmd on a Mac is sent
 * as ctrl: the box runs Linux, where the shortcut people mean by ⌘C is
 * ctrl+c, and forwarding a Super chord would do nothing there.
 */
export function keysymFor(event: KeyEventLike): { kind: "key"; key: string } | null {
  // Function keys are already X's own names, and they are neither in the
  // rename table nor a single character — so they are answered before the
  // guard below rejects everything that is neither.
  if (/^F\d{1,2}$/.test(event.key)) return { kind: "key", key: event.key };
  const named = NAMED[event.key];
  const printable = event.key.length === 1;
  if (!named && !printable) return null;

  const modifiers: string[] = [];
  if (event.ctrlKey || event.metaKey) modifiers.push("ctrl");
  if (event.altKey) modifiers.push("alt");

  let base = named ?? event.key;
  if (!named && printable) {
    if (PUNCTUATION[event.key]) base = PUNCTUATION[event.key];
    else if (/^[A-Z]$/.test(event.key)) {
      // Shift is implied by the capital itself; sending shift+A as a chord
      // would type an uppercase A on some layouts and nothing on others.
      base = event.key;
    } else if (!/^[a-z0-9]$/i.test(event.key)) {
      return null;
    }
  }
  // An unmodified printable character belongs to the text field, not to a
  // key chord — typing there is how words get in, and this path exists for
  // the keys a text field cannot send.
  if (!modifiers.length && !named && printable) return null;
  return { kind: "key", key: [...modifiers, base].join("+") };
}
