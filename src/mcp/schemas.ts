import { z } from "zod";

const SlugSchema = z.string().min(1);
const PrioritySchema = z.enum(["P0", "P1", "P2"]);

export const SpecListShape = {
  state: z.enum(["active", "done", "blocked", "all"]).optional(),
  mine: z.boolean().optional(),
} as const;

export const SpecReadShape = {
  slug: SlugSchema,
  parts: z.array(z.enum(["spec", "plan", "tasks"])).optional(),
} as const;

export const SpecStatusShape = {
  slug: SlugSchema,
  recent_limit: z.number().int().min(0).optional(),
  since: z.string().optional(),
} as const;

export const SpecLintShape = {
  slug: SlugSchema.optional(),
  include_done: z.boolean().optional(),
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
} as const;

export const SddDoctorShape = {} as const;

export const SpecApproveShape = {
  slug: SlugSchema,
  note: z.string().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
} as const;

const RatifyDecisionSchema = z.object({
  text: z.string(),
  as_of_dtg: z.string().optional(),
});

export const SpecRatifyShape = {
  slug: SlugSchema,
  decisions: z.record(z.string(), RatifyDecisionSchema).optional(),
  default_disposition: z.string().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
} as const;

export const SpecTaskCheckShape = {
  slug: SlugSchema,
  phase: PrioritySchema,
  match: z.union([z.string(), z.number().int().min(1)]),
  checked: z.boolean(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
} as const;

export const SpecTaskAddShape = {
  slug: SlugSchema,
  phase: PrioritySchema,
  text: z.string().min(1),
  blocker: z.boolean().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
} as const;

export const SpecHandoffShape = {
  slug: SlugSchema,
  new_owner: z.string().min(1),
  note: z.string().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
} as const;

export const SpecClaimShape = {
  slug: SlugSchema,
  claimer: z.string().optional(),
  ratify: z.boolean().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
} as const;

export const SpecCloseShape = {
  slug: SlugSchema,
  summary: z.string().min(1),
  allow_open: z.array(PrioritySchema).optional(),
  commit: z.boolean().optional(),
  push: z.boolean().optional(),
  dryRun: z.boolean().optional(),
} as const;

export const SpecReopenShape = {
  slug: SlugSchema,
  reason: z.string().min(1),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
} as const;

export const SpecBlockShape = {
  slug: SlugSchema,
  reason: z.string().min(1),
  blocker_path: z.string().optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
} as const;

export const SpecUnblockShape = {
  slug: SlugSchema,
  resolution: z.string().min(1),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
} as const;

export const SpecIndexRebuildShape = {
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
} as const;

export const SpecInitShape = {
  profile: z.enum(["default", "bastion"]),
  overrides: z.record(z.string(), z.unknown()).optional(),
  commit: z.boolean().optional(),
  dryRun: z.boolean().optional(),
} as const;
