/** Normalize both MausCrew's ask_user tool and Claude Code's built-in
 * AskUserQuestion permission call into the question card vocabulary. */
export function permissionQuestion(name, args) {
    if (typeof args !== "object" || args === null)
        return null;
    const input = args;
    if (name === "ask_user") {
        return {
            question: typeof input.question === "string" ? input.question : "",
            choices: stringChoices(input.choices),
            intercepted: false,
        };
    }
    if (name === "request_secret") {
        return {
            question: typeof input.reason === "string" ? input.reason : "A credential is needed to continue.",
            // Offering choices for a secret makes no sense and a "no" button that
            // looks like an answer invites tapping it with a real key in the field.
            choices: [],
            intercepted: false,
            secret: true,
        };
    }
    if (typeof input.tool_name !== "string" || input.tool_name.toLowerCase() !== "askuserquestion")
        return null;
    const toolInput = typeof input.input === "object" && input.input !== null
        ? input.input
        : {};
    const questions = Array.isArray(toolInput.questions) ? toolInput.questions : [];
    const first = typeof questions[0] === "object" && questions[0] !== null
        ? questions[0]
        : toolInput;
    const options = Array.isArray(first.options) ? first.options : [];
    return {
        question: typeof first.question === "string" ? first.question : "Claude Code has a question",
        choices: options
            .map((option) => typeof option === "object" && option !== null ? option.label : option)
            .filter((choice) => typeof choice === "string" && Boolean(choice))
            .slice(0, 5),
        intercepted: true,
    };
}
function stringChoices(value) {
    return Array.isArray(value)
        ? value.filter((choice) => typeof choice === "string" && Boolean(choice)).slice(0, 5)
        : [];
}
