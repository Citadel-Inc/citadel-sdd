export interface ChecklistCounts {
  open: number;
  done: number;
  human: number;
}

const RE_ITEM = /^\s*-\s*\[([ xX])\]\s+(.*)$/;

export function scanChecklist(text: string): ChecklistCounts {
  const out: ChecklistCounts = { open: 0, done: 0, human: 0 };
  for (const raw of text.split(/\r?\n/)) {
    const m = RE_ITEM.exec(raw);
    if (!m) continue;
    const mark = m[1] ?? " ";
    const body = (m[2] ?? "").trim();
    const checked = mark.toLowerCase() === "x";
    if (checked) out.done += 1;
    else out.open += 1;
    if (!checked && body.startsWith("[HUMAN]")) out.human += 1;
  }
  return out;
}
