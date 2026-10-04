// Cheap token estimation.
//
// Deliberately a heuristic and not a tokenizer: the only decision it feeds is
// "is this thread long enough to fold up yet", and being wrong by ten percent
// changes that answer by one message. A real tokenizer would cost a dependency
// per engine — MausCrew drives four of them — to sharpen a threshold nobody
// perceives.
//
// The two overheads matter more than they look. Chat formats spend tokens on
// role markers and message framing, and a tool call spends them again on the
// name and the JSON envelope, so a transcript of many short messages costs far
// more than its character count suggests.
/** English prose in most BPE vocabularies. Undershooting is the safe error. */
const CHARS_PER_TOKEN = 2.5;
const MESSAGE_OVERHEAD_CHARS = 25;
const TOOL_CALL_OVERHEAD_CHARS = 50;
/** Characters a message costs, framing included. */
export function messageChars(message) {
    let chars = MESSAGE_OVERHEAD_CHARS + (message.text?.length ?? 0);
    if (message.tool)
        chars += TOOL_CALL_OVERHEAD_CHARS + (message.tool.name?.length ?? 0);
    return chars;
}
export function estimateTokens(messages) {
    let chars = 0;
    for (const message of messages)
        chars += messageChars(message);
    return Math.ceil(chars / CHARS_PER_TOKEN);
}
