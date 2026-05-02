import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { sddDoctor } from "../tools/sdd_doctor.js";
import { specApprove } from "../tools/spec_approve.js";
import { specBlock } from "../tools/spec_block.js";
import { specClaim } from "../tools/spec_claim.js";
import { specClose } from "../tools/spec_close.js";
import { specHandoff } from "../tools/spec_handoff.js";
import { specIndexRebuild } from "../tools/spec_index_rebuild.js";
import { specInit } from "../tools/spec_init.js";
import { specLint } from "../tools/spec_lint.js";
import { specList } from "../tools/spec_list.js";
import { specRatify } from "../tools/spec_ratify.js";
import { specRead } from "../tools/spec_read.js";
import { specReopen } from "../tools/spec_reopen.js";
import { specStatus } from "../tools/spec_status.js";
import { specTaskAdd } from "../tools/spec_task_add.js";
import { specTaskCheck } from "../tools/spec_task_check.js";
import { specTaskList } from "../tools/spec_task_list.js";
import { specUnblock } from "../tools/spec_unblock.js";
import type { ToolContext } from "../tools/types.js";
import {
  SddDoctorShape,
  SpecApproveShape,
  SpecBlockShape,
  SpecClaimShape,
  SpecCloseShape,
  SpecHandoffShape,
  SpecIndexRebuildShape,
  SpecInitShape,
  SpecLintShape,
  SpecListShape,
  SpecRatifyShape,
  SpecReadShape,
  SpecReopenShape,
  SpecStatusShape,
  SpecTaskAddShape,
  SpecTaskCheckShape,
  SpecTaskListShape,
  SpecUnblockShape,
} from "./schemas.js";

export type ToolContextFactory = () => ToolContext;

interface CallResult {
  [x: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

function ok(value: unknown): CallResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

function err(e: unknown): CallResult {
  const message = e instanceof Error ? e.message : String(e);
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

function wrap<I, O>(fn: (input: I, ctx: ToolContext) => O, factory: ToolContextFactory) {
  return async (input: I): Promise<CallResult> => {
    try {
      return ok(fn(input, factory()));
    } catch (e) {
      return err(e);
    }
  };
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
      description: "List specs by lifecycle state, optionally filtered to caller.",
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
    "spec_approve",
    {
      description: "Atomic DRAFT → APPROVED.",
      inputSchema: SpecApproveShape,
    },
    wrap(specApprove, ctxFactory),
  );

  server.registerTool(
    "spec_ratify",
    {
      description: "Replace TBD rows in Q-table with Ratified <DTG>.",
      inputSchema: SpecRatifyShape,
    },
    wrap(specRatify, ctxFactory),
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
    "spec_claim",
    {
      description: "Composite DRAFT/APPROVED → IN_PROGRESS + optional Q-table ratify + commit.",
      inputSchema: SpecClaimShape,
    },
    wrap(specClaim, ctxFactory),
  );

  server.registerTool(
    "spec_close",
    {
      description:
        "Composite IN_PROGRESS → DONE + git mv active→done + index rebuild + commit + optional push.",
      inputSchema: SpecCloseShape,
    },
    wrap(specClose, ctxFactory),
  );

  server.registerTool(
    "spec_reopen",
    {
      description: "Composite DONE → IN_PROGRESS + git mv done→active + index rebuild + commit.",
      inputSchema: SpecReopenShape,
    },
    wrap(specReopen, ctxFactory),
  );

  server.registerTool(
    "spec_block",
    {
      description: "Composite IN_PROGRESS → BLOCKED + ## Blocking section + commit.",
      inputSchema: SpecBlockShape,
    },
    wrap(specBlock, ctxFactory),
  );

  server.registerTool(
    "spec_unblock",
    {
      description: "Composite BLOCKED → IN_PROGRESS + remove ## Blocking + commit.",
      inputSchema: SpecUnblockShape,
    },
    wrap(specUnblock, ctxFactory),
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
