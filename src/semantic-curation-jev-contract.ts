import { z } from "zod";

/** Vendor-neutral head format consumed by a host-owned semantic decision transport. */
export const mssrJevDecisionQuestionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("choice"), prompt: z.string().min(1).max(8_000), options: z.record(z.string().min(1).max(2_000)) }).strict(),
  z.object({ kind: z.literal("noul"), prompt: z.string().min(1).max(8_000) }).strict(),
]).superRefine((value, ctx) => {
  if (value.kind === "choice" && Object.keys(value.options).length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choice questions require at least two options." });
  }
});

export const mssrJevDecisionRequestSchema = z.object({
  state: z.unknown().superRefine((state, ctx) => {
    let serialized: string | undefined;
    try { serialized = JSON.stringify(state); } catch { /* reported as invalid JSON below */ }
    if (serialized === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Decision state must be JSON serializable." });
    } else if (serialized.length > 262_144) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Decision state exceeds the 262144-character transport limit." });
    }
  }),
  questions: z.record(mssrJevDecisionQuestionSchema).refine((questions) => Object.keys(questions).length > 0, "At least one decision question is required."),
  model: z.string().min(1).max(120).optional(),
}).strict();

const mssrJevDecisionAnswerSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("choice"),
    choice: z.string().min(1),
    confidence: z.number().min(0).max(1),
    /** Optional provider distribution retained for bounded within-shard candidate shortlisting. */
    probabilities: z.record(z.string().min(1), z.number().min(0).max(1)).optional(),
  }).strict(),
  z.object({ type: z.literal("noul"), noul: z.number().min(0).max(1) }).strict(),
]);

export const mssrJevDecisionResponseSchema = z.object({
  provider: z.string().min(1).max(120),
  model: z.string().min(1).max(120),
  answers: z.record(mssrJevDecisionAnswerSchema),
  usage: z.object({ input_tokens: z.number().int().min(0), output_tokens: z.number().int().min(0) }).strict(),
}).strict();

export type MssrJevDecisionQuestion = z.infer<typeof mssrJevDecisionQuestionSchema>;
export type MssrJevDecisionRequest = z.infer<typeof mssrJevDecisionRequestSchema>;
export type MssrJevDecisionAnswer = z.infer<typeof mssrJevDecisionAnswerSchema>;
export type MssrJevDecisionResponse = z.infer<typeof mssrJevDecisionResponseSchema>;

/**
 * Host-owned boundary for one bounded System-One style decision. Implementations
 * own credentials, endpoint selection, transport, retries, cancellation and logs.
 * MSSR supplies only the bounded state/questions and consumes normalized answers.
 */
export interface MssrJevDecisionProvider {
  executeSystemOne(request: MssrJevDecisionRequest): Promise<MssrJevDecisionResponse>;
}

/** Validate response shape and enforce an exact correspondence to the offered heads. */
export function validateMssrJevDecisionResponse(
  request: MssrJevDecisionRequest,
  response: unknown,
): MssrJevDecisionResponse {
  const parsedRequest = mssrJevDecisionRequestSchema.parse(request);
  const parsed = mssrJevDecisionResponseSchema.parse(response);
  const expectedKeys = Object.keys(parsedRequest.questions).sort();
  const actualKeys = Object.keys(parsed.answers).sort();
  if (expectedKeys.length !== actualKeys.length || expectedKeys.some((key, index) => key !== actualKeys[index])) {
    throw new Error("Jev decision response answers must exactly match the requested question keys.");
  }
  for (const [key, question] of Object.entries(parsedRequest.questions)) {
    const answer = parsed.answers[key];
    if (question.kind === "choice") {
      if (answer.type !== "choice" || !(answer.choice in question.options)) {
        throw new Error(`Jev decision response contains an invalid choice for '${key}'.`);
      }
      if (answer.type === "choice" && answer.probabilities) {
        const expectedOptions = Object.keys(question.options).sort();
        const returnedOptions = Object.keys(answer.probabilities).sort();
        if (expectedOptions.length !== returnedOptions.length || expectedOptions.some((option, index) => option !== returnedOptions[index])) {
          throw new Error(`Jev decision response probabilities must exactly match the offered choices for '${key}'.`);
        }
        const totalProbability = Object.values(answer.probabilities).reduce((sum, probability) => sum + probability, 0);
        if (Math.abs(totalProbability - 1) > 0.02) {
          throw new Error(`Jev decision response probabilities must sum to approximately 1 for '${key}'.`);
        }
        const selectedProbability = answer.probabilities[answer.choice];
        const highestProbability = Math.max(...Object.values(answer.probabilities));
        if (highestProbability - selectedProbability > 0.02) {
          throw new Error(`Jev decision response choice must have the highest reported probability for '${key}'.`);
        }
      }
    } else if (answer.type !== "noul") {
      throw new Error(`Jev decision response contains an invalid Noul answer for '${key}'.`);
    }
  }
  return parsed;
}
