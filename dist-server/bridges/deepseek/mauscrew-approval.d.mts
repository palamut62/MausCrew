// Types for the Cordis plugin. The plugin itself stays plain JavaScript —
// it is loaded by a Node runtime that has no build step of ours — so this
// declares only the part MausCrew's own tests import.
export declare const name: string;
/** Whether a tool call has to be shown to a human before it runs. */
export declare function needsApproval(toolName: string): boolean;
export declare function unsupportedCordisClientReason(toolName: string, args: unknown): string | null;
export declare function rememberCordisDefinition(
  definitions: Map<string, { name: string; purpose: string; host: string }>,
  toolName: string,
  args: unknown,
  result: unknown,
  sessionId?: string,
): void;
export declare function summarize(
  toolName: string,
  args: unknown,
  definitions?: Map<string, { name: string; purpose: string; host: string }>,
  sessionId?: string,
): string;
export declare function apply(ctx: unknown, config?: unknown): void;
