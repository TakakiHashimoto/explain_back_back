import { describe, expect, test } from "bun:test";
import { AnalysisSchema } from "../src/features/explanation/analysis/analysisSchema.js";

const valid = {
  strengths: [{ concept: "TCP handshake", explanation: "Correctly identifies SYN and ACK" }],
  gaps: [{ concept: "sequence numbers", misconception: "No description of ordering", severity: 2 }],
  scores: { accuracy: 80, clarity: 70, completeness: 60, overall: 70 },
};

describe("structured explanation analysis contract", () => {
  test("accepts a grounded result with integer severity", () => {
    expect(AnalysisSchema.parse(valid).gaps[0]?.severity).toBe(2);
  });

  test("allows excellent explanations with no gaps", () => {
    expect(AnalysisSchema.parse({ ...valid, gaps: [] }).gaps).toEqual([]);
  });

  test.each(["moderate", 0, 4, 1.5, null])("rejects invalid severity %p", (severity) => {
    expect(AnalysisSchema.safeParse({ ...valid, gaps: [{ ...valid.gaps[0], severity }] }).success).toBe(false);
  });

  test.each([-1, 101, 78.5])("rejects invalid score %p", (overall) => {
    expect(AnalysisSchema.safeParse({ ...valid, scores: { ...valid.scores, overall } }).success).toBe(false);
  });

  test("limits question generation to five gaps and rejects empty concepts", () => {
    const gap = valid.gaps[0];
    expect(AnalysisSchema.safeParse({ ...valid, gaps: Array(6).fill(gap) }).success).toBe(false);
    expect(AnalysisSchema.safeParse({ ...valid, gaps: [{ ...gap, concept: " " }] }).success).toBe(false);
  });
});
