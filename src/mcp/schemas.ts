import { z } from "zod";

const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const PrioritySchema = z.enum(["P0", "P1", "P2"]);
const WorkspacePickShape = {
  workspaceRoot: z.string().optional().describe("Highest-priority workspace root override."),
  rootIndex: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("0-based index into the MCP file roots list; ignored when workspaceRoot is set."),
} as const;

function withWorkspacePick<T extends Record<string, z.ZodType>>(
  shape: T,
): T & typeof WorkspacePickShape {
  return { ...WorkspacePickShape, ...shape };
}

export const SpecListShape = withWorkspacePick({
  state: z.enum(["active", "done", "parked", "blocked", "all"]).optional(),
  mine: z.boolean().optional(),
});

export const SpecReadShape = withWorkspacePick({
  slug: SlugSchema,
  parts: z.array(z.enum(["spec", "plan", "tasks"])).optional(),
});

export const SpecStatusShape = withWorkspacePick({
  slug: SlugSchema,
  recent_limit: z.number().int().min(0).optional(),
  since: z.string().optional(),
});

export const SpecLintShape = withWorkspacePick({
  slug: SlugSchema.optional(),
  include_done: z.boolean().optional(),
  include_parked: z.boolean().optional(),
  no_strict: z.boolean().optional(),
  fail_on: z.union([z.array(z.string()), z.literal("all")]).optional(),
  roots: z.array(z.string()).optional(),
  scan_nested: z
    .object({
      parent: z.string(),
      depth: z.number().int().min(0).optional(),
    })
    .optional(),
  stale_days: z.number().int().min(0).optional(),
});

export const SddDoctorShape = withWorkspacePick({});

export const SpecApproveShape = withWorkspacePick({
  slug: SlugSchema,
  note: z.string().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

const RatifyDecisionSchema = z.object({
  text: z.string(),
  as_of_dtg: z.string().optional(),
});

export const SpecRatifyShape = withWorkspacePick({
  slug: SlugSchema,
  decisions: z.record(z.string(), RatifyDecisionSchema).optional(),
  default_disposition: z.string().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

const TaskCheckItemSchema = z.object({
  phase: PrioritySchema,
  match: z.union([z.string(), z.number().int().min(1)]),
  checked: z.boolean(),
});

export const SpecTaskCheckShape = withWorkspacePick({
  slug: SlugSchema,
  /** Batch form — check/uncheck multiple items in one call. */
  items: z.array(TaskCheckItemSchema).optional(),
  /** Flat single-item form (backward compat). */
  phase: PrioritySchema.optional(),
  match: z.union([z.string(), z.number().int().min(1)]).optional(),
  checked: z.boolean().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const SpecTaskListShape = withWorkspacePick({
  slug: SlugSchema,
  phases: z.array(PrioritySchema).optional(),
});

export const SpecTaskAddShape = withWorkspacePick({
  slug: SlugSchema,
  phase: PrioritySchema,
  text: z.string().min(1),
  blocker: z.boolean().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const SpecHandoffShape = withWorkspacePick({
  slug: SlugSchema,
  new_owner: z.string().min(1).optional(),
  note: z.string().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const SpecClaimShape = withWorkspacePick({
  slug: SlugSchema,
  claimer: z.string().optional(),
  ratify: z.boolean().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const SpecCloseShape = withWorkspacePick({
  slug: SlugSchema,
  summary: z.string().min(1).optional(),
  allow_open: z.array(PrioritySchema).optional(),
  commit: z.boolean().optional(),
  push: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const SpecReopenShape = withWorkspacePick({
  slug: SlugSchema,
  reason: z.string().min(1),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const SpecParkShape = withWorkspacePick({
  slug: SlugSchema,
  resolution: z.string().min(1),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const SpecBlockShape = withWorkspacePick({
  slug: SlugSchema,
  reason: z.string().min(1),
  blocker_path: z.string().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const SpecUnblockShape = withWorkspacePick({
  slug: SlugSchema,
  resolution: z.string().min(1),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const SpecUnparkShape = withWorkspacePick({
  slug: SlugSchema,
  resolution: z.string().min(1),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const SpecIndexRebuildShape = withWorkspacePick({
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

export const SpecInitShape = withWorkspacePick({
  profile: z.string().min(1),
  overrides: z.record(z.string(), z.unknown()).optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});
