import { rmSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { DATA_DIR } from "./config.ts";
import { evaluationResults, evaluationScenarios, runEvaluation } from "./evaluations.ts";

describe("evaluation runner", () => {
  beforeEach(() => rmSync(DATA_DIR, { recursive: true, force: true }));
  it("runs the same scenario criteria and records timing and tokens", async () => {
    const scenario = evaluationScenarios()[0]!;
    const result = await runEvaluation("fake-engine", scenario, async (prompt) => {
      expect(prompt).toBe(scenario.prompt);
      return { output: JSON.stringify(scenario.expected), inputTokens: 3, outputTokens: 5 };
    });
    expect(result.status).toBe("success");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.inputTokens).toBe(3);
    expect(result.outputTokens).toBe(5);
    expect(evaluationResults().at(-1)?.scenarioId).toBe(scenario.id);
  });
  it("does not confuse a reply or empty output with satisfying the criterion", async () => {
    for (const output of ["", "done", '{"verified":true,"state":"success"}']) {
      const result = await runEvaluation("fake", evaluationScenarios()[2]!, async () => ({ output }));
      expect(result.status).toBe("failed");
      expect(result.inputTokens).toBeUndefined();
    }
  });
  it("records unavailable or failed execution as error instead of zero usage", async () => {
    const result = await runEvaluation("unavailable", evaluationScenarios()[1]!, async () => { throw new Error("engine unavailable"); });
    expect(result.status).toBe("error");
    expect(result.error).toContain("unavailable");
    expect(result.inputTokens).toBeUndefined();
  });
});
