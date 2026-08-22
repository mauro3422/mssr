import { z } from "zod";
import {
  PROJECT_CONTEXT_TOPICS,
  defaultKindForProjectContextTopic,
  projectContextModuleSchema,
  projectContextRequiredWhenSchema,
  type ProjectContextModule,
} from "./project-context.js";
import { mssrKnowledgeRelativePath } from "./project-home.js";
import {
  SKILL_ACTIONS,
  SKILL_ARTIFACTS,
  SKILL_DOMAINS,
  SKILL_NEEDS,
  SKILL_SIGNALS,
  SKILL_STAGES,
} from "./skill-routing.js";

const selectorFields = {
  stages: z.array(z.enum(SKILL_STAGES)).max(6).default([]),
  domains: z.array(z.enum(SKILL_DOMAINS)).max(8).default([]),
  actions: z.array(z.enum(SKILL_ACTIONS)).max(12).default([]),
  artifacts: z.array(z.enum(SKILL_ARTIFACTS)).max(12).default([]),
  needs: z.array(z.enum(SKILL_NEEDS)).max(12).default([]),
  signals: z.array(z.enum(SKILL_SIGNALS)).max(12).default([]),
};

export const mssrProjectKnowledgeCaptureInputSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  topic: z.enum(PROJECT_CONTEXT_TOPICS),
  area: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/).optional(),
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(1).max(20_000),
  kind: z.enum(["context", "memory", "state", "directive"]).optional(),
  description: z.string().trim().min(1).max(300).optional(),
  ...selectorFields,
  required: z.boolean().default(false),
  requiredWhen: projectContextRequiredWhenSchema.optional(),
  priority: z.number().int().min(-100).max(100).default(20),
  maxChars: z.number().int().min(200).max(20_000).optional(),
  exclusiveGroup: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/).optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.required || value.requiredWhen) && value.exclusiveGroup) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Required or conditionally required project knowledge cannot belong to an exclusive group." });
  }
  const inferredKind = value.kind ?? defaultKindForProjectContextTopic(value.topic);
  const hasSelector = value.requiredWhen !== undefined
    || [value.stages, value.domains, value.actions, value.artifacts, value.needs, value.signals].some((items) => items.length > 0);
  if (inferredKind === "directive" && !hasSelector) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A directive capture requires at least one selector or requiredWhen applicability rule." });
  }
});

export type MssrProjectKnowledgeCaptureInput = z.infer<typeof mssrProjectKnowledgeCaptureInputSchema>;

export function planMssrProjectKnowledgeCapture(input: MssrProjectKnowledgeCaptureInput): {
  relativePath: string;
  markdown: string;
  module: ProjectContextModule;
  advisoryOnly: true;
  policy: string;
} {
  const parsed = mssrProjectKnowledgeCaptureInputSchema.parse(input);
  const kind = parsed.kind ?? defaultKindForProjectContextTopic(parsed.topic);
  const relativePath = mssrKnowledgeRelativePath(parsed.topic, `${parsed.id}.md`);
  const markdown = `# ${parsed.title}\n\n${parsed.content.trim()}\n`;
  const module = projectContextModuleSchema.parse({
    id: parsed.id,
    kind,
    topic: parsed.topic,
    ...(parsed.area ? { area: parsed.area } : {}),
    description: parsed.description ?? `${parsed.title} (${parsed.topic} project knowledge).`,
    source: { path: relativePath },
    stages: parsed.stages,
    domains: parsed.domains,
    actions: parsed.actions,
    artifacts: parsed.artifacts,
    needs: parsed.needs,
    signals: parsed.signals,
    required: parsed.required,
    ...(parsed.requiredWhen ? { requiredWhen: parsed.requiredWhen } : {}),
    priority: parsed.priority,
    maxChars: parsed.maxChars ?? Math.max(500, Math.min(20_000, Buffer.byteLength(markdown, "utf8") + 512)),
    ...(parsed.exclusiveGroup ? { exclusiveGroup: parsed.exclusiveGroup } : {}),
  });
  return {
    relativePath,
    markdown,
    module,
    advisoryOnly: true,
    policy: kind === "memory"
      ? "Optional durable memory is reference-backed by default: capture reviewed project knowledge in .mssr/knowledge and index it through the single project-context manifest. Keep PROJECT_MEMORY.md for compact core/cross-area memory. Never persist a raw conversation, hidden reasoning, secrets, or transient tool output."
      : "Capture only reviewed durable project knowledge. Never persist a raw conversation, hidden reasoning, secrets, or transient tool output.",
  };
}
