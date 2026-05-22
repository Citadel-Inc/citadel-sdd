import { describe, expect, test } from "bun:test";
import { resolveBuiltIn, resolveProfile } from "../../src/profile/resolver.js";

describe("resolveBuiltIn — shipped profiles", () => {
  test("default profile loads with neutral baseline", () => {
    const p = resolveBuiltIn("default");
    expect(p.spec_dir).toBe("specs");
    expect(p.dtg_format).toBe("ISO-8601");
    expect(p.commit_style).toBe("freeform");
    expect(p.push_policy).toBe("never");
    expect(p.priorities).toEqual(["P0", "P1", "P2"]);
    expect(p.states).toEqual(["DRAFT", "APPROVED", "IN_PROGRESS", "BLOCKED", "DONE"]);
  });

  test("bastion extends default; flips DTG + commit_style; inherits push_policy", () => {
    const p = resolveBuiltIn("bastion");
    expect(p.dtg_format).toBe("DDHHMMZMONYY");
    expect(p.commit_style).toBe("conventional");
    expect(p.push_policy).toBe("never");
    expect(p.spec_dir).toBe("specs");
  });

  test("built-in rejects 'citadel' — project-specific profiles live in consuming repo", () => {
    expect(() => resolveBuiltIn("citadel")).toThrow("profile_unknown");
  });

  test("unknown built-in profile name rejected", () => {
    expect(() => resolveBuiltIn("nonexistent")).toThrow("profile_unknown");
  });
});

describe("resolveProfile — extending", () => {
  test("extends:bastion + push_policy override", () => {
    const p = resolveProfile({ extends: "bastion", push_policy: "always" });
    expect(p.dtg_format).toBe("DDHHMMZMONYY");
    expect(p.commit_style).toBe("conventional");
    expect(p.push_policy).toBe("always");
  });

  test("extends:bastion + push_policy:on_close replicates former citadel preset", () => {
    const p = resolveProfile({ extends: "bastion", push_policy: "on_close" });
    expect(p.dtg_format).toBe("DDHHMMZMONYY");
    expect(p.commit_style).toBe("conventional");
    expect(p.push_policy).toBe("on_close");
  });

  test("no extends; explicit fields use defaults for omitted keys", () => {
    const p = resolveProfile({ commit_style: "conventional" });
    expect(p.commit_style).toBe("conventional");
    expect(p.dtg_format).toBe("ISO-8601");
    expect(p.push_policy).toBe("never");
  });

  test("rejects unknown extends:", () => {
    expect(() => resolveProfile({ extends: "unicorn" })).toThrow("profile_chain_broken");
  });

  test("custom resolveExtra hook can supply non-built-in parent", () => {
    const custom: Record<string, Record<string, unknown>> = {
      "team-x": { extends: "bastion", push_policy: "always" },
    };
    const p = resolveProfile(
      { extends: "team-x" },
      {
        resolveExtra: (name) => custom[name],
      },
    );
    expect(p.commit_style).toBe("conventional");
    expect(p.push_policy).toBe("always");
  });

  test("cycle detection rejects a -> b -> a", () => {
    const custom: Record<string, Record<string, unknown>> = {
      a: { extends: "b" },
      b: { extends: "a" },
    };
    expect(() => resolveProfile({ extends: "a" }, { resolveExtra: (n) => custom[n] })).toThrow(
      "profile_cycle",
    );
  });

  test("self-cycle a -> a rejected", () => {
    const custom: Record<string, Record<string, unknown>> = {
      a: { extends: "a" },
    };
    expect(() => resolveProfile({ extends: "a" }, { resolveExtra: (n) => custom[n] })).toThrow(
      "profile_cycle",
    );
  });
});

describe("resolveProfile — schema validation", () => {
  test("rejects invalid dtg_format", () => {
    expect(() => resolveProfile({ dtg_format: "garbage" } as Record<string, unknown>)).toThrow();
  });

  test("rejects invalid push_policy", () => {
    expect(() => resolveProfile({ push_policy: "force" } as Record<string, unknown>)).toThrow();
  });

  test("rejects extra unknown keys (strict)", () => {
    expect(() => resolveProfile({ unknown_key: "value" } as Record<string, unknown>)).toThrow();
  });
});

describe("resolveProfile — final merged shape", () => {
  test("extends key stripped from final Profile", () => {
    const p = resolveProfile({ extends: "default" }) as Record<string, unknown>;
    expect(p.extends).toBeUndefined();
  });
});
