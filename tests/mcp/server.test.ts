import { afterEach, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildServer } from "../../src/mcp/server.js";
import { resolveBuiltIn } from "../../src/profile/resolver.js";
import type { ToolContext } from "../../src/tools/types.js";
import { makeTempRepo, type TempRepo } from "../helpers/temp-repo.js";

let temp: TempRepo | undefined;

afterEach(() => {
  temp?.cleanup();
  temp = undefined;
});

const CLOCK = (): Date => new Date(Date.UTC(2026, 4, 1, 19, 45, 0));

function ctxFactory(): () => ToolContext {
  return () => {
    if (!temp) throw new Error("temp repo not initialized");
    return { rootDir: temp.rootDir, profile: resolveBuiltIn("bastion"), clock: CLOCK };
  };
}

async function dial(): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = buildServer({ contextFactory: ctxFactory() });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const client = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe("MCP server wiring", () => {
  test("listTools returns the full 17-tool roster", async () => {
    temp = makeTempRepo();
    const { client, close } = await dial();
    const list = await client.listTools();
    const names = list.tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "sdd_doctor",
        "spec_approve",
        "spec_block",
        "spec_claim",
        "spec_close",
        "spec_handoff",
        "spec_index_rebuild",
        "spec_init",
        "spec_lint",
        "spec_list",
        "spec_ratify",
        "spec_read",
        "spec_reopen",
        "spec_status",
        "spec_task_add",
        "spec_task_check",
        "spec_unblock",
      ].sort(),
    );
    await close();
  });

  test("callTool spec_list returns active fixtures", async () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal", "approved-ratified"] });
    const { client, close } = await dial();
    const res = await client.callTool({ name: "spec_list", arguments: {} });
    expect(res.isError).not.toBe(true);
    const content = res.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]?.text ?? "[]") as Array<{ slug: string }>;
    expect(data.map((d) => d.slug).sort()).toEqual(["approved-ratified", "draft-minimal"]);
    await close();
  });

  test("callTool spec_status returns expected snapshot", async () => {
    temp = makeTempRepo({ activeFixtures: ["approved-ratified"] });
    const { client, close } = await dial();
    const res = await client.callTool({
      name: "spec_status",
      arguments: { slug: "approved-ratified" },
    });
    const content = res.content as Array<{ type: string; text: string }>;
    const data = JSON.parse(content[0]?.text ?? "{}") as { state: string; ratified: boolean };
    expect(data.state).toBe("APPROVED");
    expect(data.ratified).toBe(true);
    await close();
  });

  test("callTool spec_approve mutates AND surfaces error on bad transition", async () => {
    temp = makeTempRepo({ activeFixtures: ["draft-minimal"] });
    const { client, close } = await dial();

    const ok = await client.callTool({
      name: "spec_approve",
      arguments: { slug: "draft-minimal" },
    });
    const okContent = ok.content as Array<{ type: string; text: string }>;
    expect(okContent[0]?.text ?? "").toContain("APPROVED");

    const err = await client.callTool({
      name: "spec_approve",
      arguments: { slug: "draft-minimal" },
    });
    expect(err.isError).toBe(true);
    const errContent = err.content as Array<{ type: string; text: string }>;
    expect(errContent[0]?.text ?? "").toContain("state_invalid");

    await close();
  });

  test("callTool with invalid input surfaces validation error", async () => {
    temp = makeTempRepo();
    const { client, close } = await dial();
    const res = await client.callTool({
      name: "spec_status",
      arguments: { slug: 123 } as Record<string, unknown>,
    });
    expect(res.isError).toBe(true);
    await close();
  });
});
