// Letting the *user* drive the bot's computer, not just watch it.
//
// The panel has always been a mirror: a JPEG every second or so, and an
// "Open desktop" that only works where a desktop session is reachable. That
// is enough right up to the moment the bot hits a sign-in, a CAPTCHA, or a
// dialog it must not answer — the exact moments the docs tell the user to
// take over. On a phone there was no way to take over at all.
//
// So: the same channel the screenshot already uses (a shell command on the
// box) carries pointer and keyboard input back. xdotool is already there —
// the capture path calls `xdotool getdisplaygeometry` — which keeps this to
// command construction rather than a second transport.
//
// Everything here is a pure string builder so the escaping, which is the part
// that matters, is testable without a box.
/** Single-quote for /bin/sh: everything is literal inside, and the only
 * character needing care is the quote itself. */
export function shellQuote(value) {
    return `'${value.replaceAll("'", `'\\''`)}'`;
}
const DISPLAY = 'export DISPLAY=${DISPLAY:-:0}';
const BUTTON_CODE = { left: 1, middle: 2, right: 3 };
/** Screens are not this big, and a coordinate outside the display either
 * misses or lands somewhere the user cannot see. */
const MAX_COORDINATE = 20_000;
/** One keystroke burst. Longer text is a paste, and a paste through
 * `xdotool type` is slow enough to look broken. */
const MAX_TYPE_CHARS = 2_000;
/** X keysyms and modifier combos: `Return`, `ctrl+c`, `alt+Tab`, `F5`. */
const KEY_PATTERN = /^[A-Za-z0-9_]+(\+[A-Za-z0-9_]+)*$/;
const coordinate = (value, name) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > MAX_COORDINATE) {
        throw Object.assign(new Error(`${name} must be a screen coordinate`), { status: 400 });
    }
    return Math.round(number);
};
/**
 * The shell command for one input event.
 *
 * Throws with a 400 rather than emitting a command for anything it does not
 * recognize: this string is about to be run on the box, so an unvalidated
 * field would be a command-injection hole rather than a bad click.
 */
export function controlCommand(input) {
    switch (input.kind) {
        case "click": {
            const x = coordinate(input.x, "x");
            const y = coordinate(input.y, "y");
            const button = BUTTON_CODE[input.button ?? "left"];
            if (!button)
                throw Object.assign(new Error("unknown pointer button"), { status: 400 });
            const repeat = input.double ? " --repeat 2 --delay 60" : "";
            return `${DISPLAY}; xdotool mousemove ${x} ${y} click${repeat} ${button}`;
        }
        case "scroll": {
            const x = coordinate(input.x, "x");
            const y = coordinate(input.y, "y");
            if (input.direction !== "up" && input.direction !== "down") {
                throw Object.assign(new Error("scroll direction must be up or down"), { status: 400 });
            }
            const amount = Math.min(10, Math.max(1, Math.round(Number(input.amount ?? 3) || 3)));
            // 4 is wheel-up and 5 is wheel-down in X11's button numbering.
            return `${DISPLAY}; xdotool mousemove ${x} ${y} click --repeat ${amount} --delay 20 ${input.direction === "up" ? 4 : 5}`;
        }
        case "type": {
            const text = String(input.text ?? "");
            if (!text)
                throw Object.assign(new Error("text is required"), { status: 400 });
            if (text.length > MAX_TYPE_CHARS) {
                throw Object.assign(new Error(`text must be at most ${MAX_TYPE_CHARS} characters`), { status: 400 });
            }
            // `--` stops xdotool reading a leading dash as its own flag.
            return `${DISPLAY}; xdotool type --delay 12 -- ${shellQuote(text)}`;
        }
        case "key": {
            const key = String(input.key ?? "").trim();
            if (!KEY_PATTERN.test(key)) {
                throw Object.assign(new Error("key must be an X keysym, optionally with modifiers (ctrl+c)"), { status: 400 });
            }
            return `${DISPLAY}; xdotool key -- ${key}`;
        }
        default:
            throw Object.assign(new Error("unknown input kind"), { status: 400 });
    }
}
/** Validate an untrusted request body into a ControlInput. Kept beside the
 * builder so the route has one thing to call and one place to look. */
export function parseControlInput(body) {
    const kind = String(body.kind ?? "");
    switch (kind) {
        case "click":
            return {
                kind: "click",
                x: Number(body.x),
                y: Number(body.y),
                ...(body.button !== undefined ? { button: String(body.button) } : {}),
                ...(body.double === true ? { double: true } : {}),
            };
        case "scroll":
            return {
                kind: "scroll",
                x: Number(body.x),
                y: Number(body.y),
                direction: String(body.direction),
                ...(body.amount !== undefined ? { amount: Number(body.amount) } : {}),
            };
        case "type":
            return { kind: "type", text: String(body.text ?? "") };
        case "key":
            return { kind: "key", key: String(body.key ?? "") };
        default:
            throw Object.assign(new Error("kind must be click, scroll, type, or key"), { status: 400 });
    }
}
