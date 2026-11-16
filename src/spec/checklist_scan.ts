const LINE_SPLIT_RE = /\r?\n/
export interface ChecklistCounts {
  open: number
  done: number
  human: number
}

const RE_ITEM = /^\s*-\s*\[([ xX])\]\s+(.*)$/

export interface ChecklistItemMatch {
  checked: boolean
  text: string
  /** Leading spaces, so an indented sub-item can be rendered back where it was. */
  indent: number
}

/**
 * The one definition of a checklist item: `- [ ]` / `- [x]`, optionally indented
 * (sub-items under a parent). Parsing, the close gate and the rewrite all go
 * through this, so an item the gate honours is an item a rewrite preserves.
 */
export function matchChecklistItem(line: string): ChecklistItemMatch | null {
  const m: RegExpExecArray | null = RE_ITEM.exec(line)
  if (!m) {
    return null
  }
  return {
    checked: (m[1] ?? ' ').toLowerCase() === 'x',
    text: m[2] ?? '',
    indent: line.length - line.trimStart().length,
  }
}

export function scanChecklist(text: string): ChecklistCounts {
  const out: ChecklistCounts = { open: 0, done: 0, human: 0 }
  for (const raw of text.split(LINE_SPLIT_RE)) {
    const item = matchChecklistItem(raw)
    if (!item) {
      continue
    }
    if (item.checked) {
      out.done += 1
    } else {
      out.open += 1
    }
    if (!item.checked && item.text.startsWith('[HUMAN]')) {
      out.human += 1
    }
  }
  return out
}
