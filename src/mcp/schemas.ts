import { z } from "zod";

const SlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const PrioritySchema = z.enum(["P0", "P1", "P2"]);
const WorkspacePickShape = {
  workspaceRoot: z
    .string()
    .optional()
    .describe("Project root override; omit to use the active workspace."),
} as const;

function withWorkspacePick<T extends Record<string, z.ZodType>>(
  shape: T,
): T & typeof WorkspacePickShape {
  return { ...WorkspacePickShape, ...shape };
}

export const SpecListShape = withWorkspacePick({
  state: z.enum(["active", "done", "parked", "blocked", "all"]).optional(),
  mine: z.boolean().optional(),
  slim: z
    .boolean()
    .optional()
    .describe(
      "Return compact rows ({slug,state,dtg,owner,p0,p1,p2,tasks}) instead of full entries. Recommended for large backlogs to stay under MCP token caps.",
    ),
  limit: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Cap the number of rows returned after sort + slim."),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Skip the first N sorted rows. Use with `limit` for cursor-style paging."),
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

const RatifyDecisionSchema = z.object({
  text: z.string(),
  as_of_dtg: z.string().optional(),
});

export const SpecTransitionActions = [
  "approve",
  "ratify",
  "claim",
  "close",
  "reopen",
  "park",
  "block",
  "unblock",
  "unpark",
] as const;

export const SpecTransitionShape = withWorkspacePick({
  slug: SlugSchema,
  to: z.enum(SpecTransitionActions),
  // approve
  note: z.string().optional(),
  // ratify
  decisions: z.record(z.string(), RatifyDecisionSchema).optional(),
  default_disposition: z.string().optional(),
  // claim
  claimer: z.string().optional(),
  ratify: z.boolean().optional(),
  // close
  summary: z.string().optional(),
  allow_open: z.array(PrioritySchema).optional(),
  push: z.boolean().optional(),
  // reopen, block (required at runtime by the underlying handler)
  reason: z.string().optional(),
  // park, unblock, unpark (required at runtime by the underlying handler)
  resolution: z.string().optional(),
  // block
  blocker_path: z.string().optional(),
  // shared
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
  /** Check/uncheck one or more items in a single call. */
  items: z.array(TaskCheckItemSchema).min(1),
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
