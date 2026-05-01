import { describe, expect, test } from "bun:test";
import { scanChecklist } from "../../src/spec/checklist_scan.js";

describe("scanChecklist", () => {
  test("counts open and done", () => {
    const text = `
- [ ] one
- [x] two
- [X] three
- [ ] four
`;
    expect(scanChecklist(text)).toEqual({ open: 2, done: 2, human: 0 });
  });

  test("counts unchecked [HUMAN] as human", () => {
    const text = `
- [ ] [HUMAN] approve cert
- [x] [HUMAN] resolved item
- [ ] regular
`;
    const c = scanChecklist(text);
    expect(c.open).toBe(2);
    expect(c.done).toBe(1);
    expect(c.human).toBe(1);
  });

  test("returns zeros on empty input", () => {
    expect(scanChecklist("")).toEqual({ open: 0, done: 0, human: 0 });
  });
});
