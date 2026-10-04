// How a bot works, as opposed to what it has.
//
// The system prompt this app assembles is an inventory: you have a computer,
// you have these connected apps, you have these tools. Useful, but it says
// nothing about how to work, and the difference between a capable model and a
// good teammate is almost entirely in the second thing.
//
// The prompt budget goes on conduct rather than inventory. The rules are
// deliberately short: a rule the model has to wade through is a rule it will
// average out with everything else in the context.
/**
 * Always-on conduct. Kept to a handful of rules on purpose — this is prepended
 * to every turn, and a page of guidance costs more than it corrects.
 */
export const CONDUCT_RULES = [
    "Work from what you can find out. Read the files, run the command, check the state — do not ask the user for something you could establish yourself. Save questions for decisions that are genuinely theirs: what they want, which trade-off they prefer, permission for something consequential.",
    "When you report, say what you actually did and what actually happened. If a command failed, show its output rather than describing it. If you skipped part of the task, say which part and why. Do not describe work as finished until it is.",
    "Verify before claiming. Running the test is evidence; believing the change was correct is not.",
].join(" ");
/**
 * Coordinator conduct: how to hand work off without either blocking on it or
 * shattering a task into fragments.
 *
 * Delegation is not blanket. Here a peer is another real bot: it costs the
 * user tokens and its turn is visible in the app, so blanket delegation would
 * spend a second budget on every request. The engine's own subagents are the
 * free path, and are named first for exactly that reason.
 */
export function coordinatorRules(options) {
    if (!options.hasPeers && !options.hasOwnSubagents)
        return "";
    const rules = [];
    if (options.hasOwnSubagents) {
        rules.push("For work that is substantial but still yours — a wide search, an end-to-end investigate-fix-verify loop, anything that will take many tool calls — use your own engine's subagents rather than grinding through it in one long reply. That keeps your own context clear for the parts that need judgement.");
    }
    if (options.hasPeers) {
        rules.push("Hand work to another bot only when it genuinely belongs to them — a different specialism, a different account, a different machine. A peer's turn costs the user tokens and appears in their app, so it is not a way to save yourself effort.", "After delegating with delegate_bot, do not sit and wait, and do not redo the work in the foreground. Finish your reply. Use check_bot when you next need to know where it got to, and stop_bot if it is no longer worth finishing.", "When several questions are independent and each belongs to a different peer, ask them together with ask_bots rather than one at a time — serial asks make the user wait for the sum of them.");
        rules.push("Do not split one coherent piece of work across several bots because it looks parallel. Work that shares context belongs to one owner; splitting it costs more in coordination than it saves.");
    }
    return rules.join(" ");
}
/**
 * A reminder for later turns in a long session.
 *
 * Rules stated once at the top of a conversation lose against everything said
 * since; models drift back to answering the immediate message. This is
 * re-stated periodically rather than every turn, because a reminder that
 * arrives constantly is just more context to average out.
 */
export const DRIFT_REMINDER = "Reminder: find things out rather than asking, report what actually happened including failures, and verify before saying something works.";
/** Turns between reminders. Long enough not to nag, short enough to catch drift. */
export const DRIFT_REMINDER_EVERY = 12;
/**
 * Whether this turn should carry the reminder.
 *
 * Counted from the number of settled turns rather than a timer: a conversation
 * that sat idle overnight has not drifted, one that ran twenty turns has.
 */
export function shouldRemind(turnsSoFar) {
    return turnsSoFar > 0 && turnsSoFar % DRIFT_REMINDER_EVERY === 0;
}
