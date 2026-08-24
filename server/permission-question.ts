export interface PermissionQuestion {
  question: string;
  choices: string[];
  intercepted: boolean;
}

/** Normalize both MausCrew's ask_user tool and Claude Code's built-in
 * AskUserQuestion permission call into the question card vocabulary. */
export function permissionQuestion(name: unknown, args: unknown): PermissionQuestion | null {
  if (typeof args !== "object" || args === null) return null;
  const input = args as Record<string, unknown>;
  if (name === "ask_user") {
    return {
      question: typeof input.question === "string" ? input.question : "",
      choices: stringChoices(input.choices),
      intercepted: false,
    };
  }

  if (typeof input.tool_name !== "string" || input.tool_name.toLowerCase() !== "askuserquestion") return null;
  const toolInput = typeof input.input === "object" && input.input !== null
    ? (input.input as Record<string, unknown>)
    : {};
  const questions = Array.isArray(toolInput.questions) ? toolInput.questions : [];
  const first = typeof questions[0] === "object" && questions[0] !== null
    ? (questions[0] as Record<string, unknown>)
    : toolInput;
  const options = Array.isArray(first.options) ? first.options : [];
  return {
    question: typeof first.question === "string" ? first.question : "Claude Code has a question",
    choices: options
      .map((option) => typeof option === "object" && option !== null ? (option as Record<string, unknown>).label : option)
      .filter((choice): choice is string => typeof choice === "string" && Boolean(choice))
      .slice(0, 5),
    intercepted: true,
  };
}

function stringChoices(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((choice): choice is string => typeof choice === "string" && Boolean(choice)).slice(0, 5)
    : [];
}
