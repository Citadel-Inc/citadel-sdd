import { z } from "zod";

export const DTG_FORMATS = ["ISO-8601", "DDHHMMZMONYY"] as const;
export const COMMIT_STYLES = ["conventional", "freeform"] as const;
export const PUSH_POLICIES = ["never", "on_close", "always"] as const;
export const FRONTMATTER_FORMATS = ["pipe-table", "inline", "any"] as const;
export const LINT_RULE_LEVELS = ["error", "warn", "off"] as const;

export type FrontmatterFormat = (typeof FRONTMATTER_FORMATS)[number];
export type LintRuleLevel = (typeof LINT_RULE_LEVELS)[number];

export const ProfileSchema = z.object({
  spec_dir: z.string().default("specs"),
  states: z
    .array(z.string())
    .default(["DRAFT", "APPROVED", "IN_PROGRESS", "BLOCKED", "DONE", "PARKED"]),
  priorities: z.array(z.string()).default(["P0", "P1", "P2"]),
  dtg_format: z.enum(DTG_FORMATS).default("ISO-8601"),
  commit_style: z.enum(COMMIT_STYLES).default("freeform"),
  push_policy: z.enum(PUSH_POLICIES).default("never"),
  frontmatter_format: z.enum(FRONTMATTER_FORMATS).default("any"),
  lint_rules: z.record(z.string(), z.enum(LINT_RULE_LEVELS)).default({}),
  default_claimer: z.string().default(""),
  default_owner: z.string().default(""),
  stale_days: z.number().int().nonnegative().optional(),
  summary_template: z.string().default(""),
  disabled_transitions: z.array(z.string()).default([]),
});

export type Profile = z.infer<typeof ProfileSchema>;

export const ProfileFragmentSchema = z
  .object({
    extends: z.string().optional(),
    spec_dir: z.string().optional(),
    states: z.array(z.string()).optional(),
    priorities: z.array(z.string()).optional(),
    dtg_format: z.enum(DTG_FORMATS).optional(),
    commit_style: z.enum(COMMIT_STYLES).optional(),
    push_policy: z.enum(PUSH_POLICIES).optional(),
    frontmatter_format: z.enum(FRONTMATTER_FORMATS).optional(),
    lint_rules: z.record(z.string(), z.enum(LINT_RULE_LEVELS)).optional(),
    default_claimer: z.string().optional(),
    default_owner: z.string().optional(),
    stale_days: z.number().int().nonnegative().optional(),
    summary_template: z.string().optional(),
    disabled_transitions: z.array(z.string()).optional(),
  })
  .strict();

export type ProfileFragment = z.infer<typeof ProfileFragmentSchema>;

export const BUILT_IN_PROFILES: ReadonlySet<string> = new Set(["default", "bastion"]);
