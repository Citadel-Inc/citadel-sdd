import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RatifyDecision } from "../spec/mutate.js";
import type { Priority } from "../spec/types.js";
import { sddDoctor } from "../tools/sdd_doctor.js";
import { type SpecApproveOutput, specApprove } from "../tools/spec_approve.js";
import { type SpecBlockOutput, specBlock } from "../tools/spec_block.js";
import { type SpecClaimOutput, specClaim } from "../tools/spec_claim.js";
import { type SpecCloseOutput, specClose } from "../tools/spec_close.js";
import { specHandoff } from "../tools/spec_handoff.js";
import { specIndexRebuild } from "../tools/spec_index_rebuild.js";
import { specInit } from "../tools/spec_init.js";
import { specLint } from "../tools/spec_lint.js";
import { specList } from "../tools/spec_list.js";
import { type SpecParkOutput, specPark } from "../tools/spec_park.js";
import { type SpecRatifyOutput, specRatify } from "../tools/spec_ratify.js";
import { specRead } from "../tools/spec_read.js";
import { type SpecReopenOutput, specReopen } from "../tools/spec_reopen.js";
import { specStatus } from "../tools/spec_status.js";
import { specTaskAdd } from "../tools/spec_task_add.js";
import { specTaskCheck } from "../tools/spec_task_check.js";
import { specTaskList } from "../tools/spec_task_list.js";
import { type SpecUnblockOutput, specUnblock } from "../tools/spec_unblock.js";
import { type SpecUnparkOutput, specUnpark } from "../tools/spec_unpark.js";
import type { ToolContext } from "../tools/types.js";
import {
  SddDoctorShape,
  SpecHandoffShape,
  SpecIndexRebuildShape,
  SpecInitShape,
  SpecLintShape,
  SpecListShape,
  SpecReadShape,
  SpecStatusShape,
  SpecTaskAddShape,
  SpecTaskCheckShape,
  SpecTaskListShape,
  SpecTransitionShape,
} from "./schemas.js";
import type { WorkspaceRootPick } from "./workspace.js";

export type ToolContextFactory = (input?: WorkspaceRootPick) => ToolContext | Promise<ToolContext>;

interface CallResult {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

function ok(value: unknown): CallResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
  };
}

function err(e: unknown): CallResult {
  const message = e instanceof Error ? e.message : String(e);
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function wrap<I extends object, O>(
  fn: (input: I, ctx: ToolContext) => O,
  factory: ToolContextFactory,
) {
  return async (input: I & WorkspaceRootPick): Promise<CallResult> => {
    try {
      return ok(fn(input, await factory(input)));
    } catch (e) {
      return err(e);
    }
  };
}

export type SpecTransitionAction =
  | "approve"
  | "ratify"
  | "claim"
  | "close"
  | "reopen"
  | "park"
  | "block"
  | "unblock"
  | "unpark";

export interface SpecTransitionInput {
  slug: string;
  to: SpecTransitionAction;
  note?: string;
  decisions?: Record<string, RatifyDecision>;
  default_disposition?: string;
  claimer?: string;
  ratify?: boolean;
  summary?: string;
  allow_open?: Priority[];
  push?: boolean;
  reason?: string;
  resolution?: string;
  blocker_path?: string;
  commit?: boolean;
  dryRun?: boolean;
}

export type SpecTransitionOutput =
  | SpecApproveOutput
  | SpecRatifyOutput
  | SpecClaimOutput
  | SpecCloseOutput
  | SpecReopenOutput
  | SpecParkOutput
  | SpecBlockOutput
  | SpecUnblockOutput
  | SpecUnparkOutput;

/**
 * Single MCP surface for the nine lifecycle-transition tools. Routes to the
 * existing per-action handlers unchanged — this is a dispatch layer only, no
 * business-logic rewrite. `reason`/`resolution` are required by the
 * underlying handlers (they self-validate and throw `reason_missing:` /
 * `resolution_missing:` on empty input), so an omitted field here is passed
 * through as `""` and surfaces that same handler-owned error.
 */
export function specTransition(input: SpecTransitionInput, ctx: ToolContext): SpecTransitionOutput {
  const { slug, commit, dryRun } = input;
  switch (input.to) {
    case "approve":
      return specApprove({ slug, note: input.note, commit, dryRun }, ctx);
    case "ratify":
      return specRatify(
        {
          slug,
          decisions: input.decisions,
          default_disposition: input.default_disposition,
          commit,
          dryRun,
        },
        ctx,
      );
    case "claim":
      return specClaim({ slug, claimer: input.claimer, ratify: input.ratify, commit, dryRun }, ctx);
    case "close":
      return specClose(
        {
          slug,
          summary: input.summary,
          allow_open: input.allow_open,
          commit,
          push: input.push,
          dryRun,
        },
        ctx,
      );
    case "reopen":
      return specReopen({ slug, reason: input.reason ?? "", commit, dryRun }, ctx);
    case "park":
      return specPark({ slug, resolution: input.resolution ?? "", commit, dryRun }, ctx);
    case "block":
      return specBlock(
        { slug, reason: input.reason ?? "", blocker_path: input.blocker_path, commit, dryRun },
        ctx,
      );
    case "unblock":
      return specUnblock({ slug, resolution: input.resolution ?? "", commit, dryRun }, ctx);
    case "unpark":
      return specUnpark({ slug, resolution: input.resolution ?? "", commit, dryRun }, ctx);
  }
}

export interface BuildServerOptions {
  contextFactory: ToolContextFactory;
  name?: string;
  version?: string;
}

export function buildServer(opts: BuildServerOptions): McpServer {
  const server = new McpServer(
    {
      name: opts.name ?? "@rethunk/citadel-sdd",
      version: opts.version ?? "0.0.1",
    },
    { capabilities: { tools: {} } },
  );

  const ctxFactory = opts.contextFactory;

  server.registerTool(
    "spec_list",
    {
      description:
        "List specs by lifecycle state, optionally filtered to caller. Large backlogs (~200+ specs) overflow MCP token caps when state='all' is used with the default row shape; pass slim:true (~80 bytes/row) or paginate with {limit, offset}.",
      inputSchema: SpecListShape,
    },
    wrap(specList, ctxFactory),
  );

  server.registerTool(
    "spec_read",
    {
      description: "Return combined spec.md + plan.md + tasks.md for a slug.",
      inputSchema: SpecReadShape,
    },
    wrap(specRead, ctxFactory),
  );

  server.registerTool(
    "spec_status",
    {
      description: "Single-spec status snapshot (state, DTG, owner, Q-table, task counts).",
      inputSchema: SpecStatusShape,
    },
    wrap(specStatus, ctxFactory),
  );

  server.registerTool(
    "spec_lint",
    {
      description: "Lint specs against canonical rules; matches archived spec-status.py.",
      inputSchema: SpecLintShape,
    },
    wrap(specLint, ctxFactory),
  );

  server.registerTool(
    "sdd_doctor",
    {
      description: "Diagnose existing repo, infer profile, flag drift.",
      inputSchema: SddDoctorShape,
    },
    wrap(sddDoctor, ctxFactory),
  );

  server.registerTool(
    "spec_transition",
    {
      description:
        "Drive a spec lifecycle transition. `to`: approve (DRAFT→APPROVED) | ratify (fill Q-table TBDs) | " +
        "claim (DRAFT/APPROVED→IN_PROGRESS) | close (IN_PROGRESS|PARKED→DONE) | reopen (DONE→IN_PROGRESS) | " +
        "park (→PARKED) | block (IN_PROGRESS→BLOCKED) | unblock (BLOCKED→IN_PROGRESS) | unpark (PARKED→IN_PROGRESS). " +
        "reason is required for reopen/block; resolution is required for park/unblock/unpark.",
      inputSchema: SpecTransitionShape,
    },
    wrap(specTransition, ctxFactory),
  );

  server.registerTool(
    "spec_task_check",
    {
      description: "Flip a tasks.md checkbox by 1-based index or text-prefix match.",
      inputSchema: SpecTaskCheckShape,
    },
    wrap(specTaskCheck, ctxFactory),
  );

  server.registerTool(
    "spec_task_list",
    {
      description:
        "Return lightweight [{phase, index, text, checked, isHumanGate}] for tasks.md. Cheaper than spec_read when you only need task item text or match strings.",
      inputSchema: SpecTaskListShape,
    },
    wrap(specTaskList, ctxFactory),
  );

  server.registerTool(
    "spec_task_add",
    {
      description: "Append a checklist item to a phase.",
      inputSchema: SpecTaskAddShape,
    },
    wrap(specTaskAdd, ctxFactory),
  );

  server.registerTool(
    "spec_handoff",
    {
      description: "Reassign Owner without state flip.",
      inputSchema: SpecHandoffShape,
    },
    wrap(specHandoff, ctxFactory),
  );

  server.registerTool(
    "spec_index_rebuild",
    {
      description: "Regenerate specs/README.md from disk-walk.",
      inputSchema: SpecIndexRebuildShape,
    },
    wrap(specIndexRebuild, ctxFactory),
  );

  server.registerTool(
    "spec_init",
    {
      description: "Bootstrap fresh repo: writes specs/config.yaml + README.md + .gitkeep stubs.",
      inputSchema: SpecInitShape,
    },
    wrap(specInit, ctxFactory),
  );

  return server;
}
