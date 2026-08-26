export interface PermissionQuestion {
  question: string;
  choices: string[];
  intercepted: boolean;
  /**
   * The answer is a credential: show a masked field, hand the value to the
   * agent, and never write it down.
   *
   * Without this an agent asking for an API key gets one typed into an
   * ordinary question card, and the card is what the transcript keeps — so the
   * key ends up in a plain JSON file on disk, for as long as the thread
   * exists, because the user did what they were asked.
   */
  secret?: boolean;
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
