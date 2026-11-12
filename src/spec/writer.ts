import type { FrontmatterFormat } from '../profile/types.ts'
import {
  renderFrontmatter,
  renderFrontmatterInline,
  renderQTable,
  renderTaskItem,
} from './render.ts'
import type { Frontmatter, ParsedSpec, ParsedTasks, Priority, QTableRow } from './types.ts'
import { PRIORITIES } from './types.ts'

const Q_HEADER_QUESTION_RE = /question/i
const Q_HEADER_DEFAULT_RE = /proposed\s*default/i
const SEPARATOR_ROW_RE = /^\|[\s:|-]+\|$/
const FIELD_PREFIX_RE = /^([A-Za-z][A-Za-z _-]*?):\s+/
const TASK_ITEM_RE = /^- \[([ xX])\] /

const LINE_SPLIT_RE = /\r?\n/
const TRAILING_NEWLINES_RE = /\n+$/
const COLLAPSE_BLANK_RE = /\n{3,}/g

interface BlockRange {
  start: number
  end: number
}

function insertAfterTitle(lines: readonly string[], block: string): string {
  // Locate insertion point: after any leading blanks + the title line + its trailing blanks.
  let i = 0
  while (i < lines.length && (lines[i] ?? '').trim() === '') {
    i += 1
  }
  if (i < lines.length) {
    i += 1 // advance past title line
  }
  while (i < lines.length && (lines[i] ?? '').trim() === '') {
    i += 1
  }
  return [...lines.slice(0, i), ...block.split('\n'), '', ...lines.slice(i)]
    .join('\n')
    .replace(COLLAPSE_BLANK_RE, '\n\n')
}

function findFirstPipeBlock(lines: readonly string[], from = 0): BlockRange | null {
  let start = -1
  for (let i = from; i < lines.length; i += 1) {
    const line = lines[i]
    if (line === undefined) {
      continue
    }
    if (line.trim().startsWith('|')) {
      start = i
      break
    }
  }
  if (start === -1) {
    return null
  }
  let end = start
  while (end < lines.length) {
    const line = lines[end]
    if (line === undefined) {
      break
    }
    if (!line.trim().startsWith('|')) {
      break
    }
    end += 1
  }
  return { start, end }
}

function findQTableBlock(lines: readonly string[]): BlockRange | null {
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    if (raw === undefined) {
      continue
    }
    const line = raw.trim()
    if (line.startsWith('|') && Q_HEADER_QUESTION_RE.test(line) && Q_HEADER_DEFAULT_RE.test(line)) {
      // Require the very next line to be a markdown table separator row,
      // so we don't mistake prose tables for Q-tables.
      const nextRaw = lines[i + 1]
      if (nextRaw === undefined || !isSeparatorRow(nextRaw.trim())) {
        continue
      }
      let end = i
      while (end < lines.length) {
        const cur = lines[end]
        if (cur === undefined) {
          break
        }
        if (!cur.trim().startsWith('|')) {
          break
        }
        end += 1
      }
      return { start: i, end }
    }
  }
  return null
}

function isSeparatorRow(line: string): boolean {
  return SEPARATOR_ROW_RE.test(line)
}

function isAtxHeading(line: string): boolean {
  return line.startsWith('# ') || line.startsWith('## ')
}

function frontmatterRegion(lines: readonly string[]): { titleIdx: number; fmEnd: number } {
  let titleIdx = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (isAtxHeading(lines[i] ?? '')) {
      titleIdx = i
      break
    }
  }
  let fmEnd = lines.length
  if (titleIdx !== -1) {
    for (let i = titleIdx + 1; i < lines.length; i += 1) {
      if (isAtxHeading(lines[i] ?? '')) {
        fmEnd = i
        break
      }
    }
  }
  return { titleIdx, fmEnd }
}

function replacePipeBlock(lines: readonly string[], block: BlockRange, rendered: string): string {
  return [...lines.slice(0, block.start), ...rendered.split('\n'), ...lines.slice(block.end)].join(
    '\n',
  )
}

function convertInlineToPipe(lines: readonly string[], newFm: Frontmatter): string {
  const fieldKeys = new Set(['status', ...newFm.fields.map(([k]) => k.toLowerCase())])
  const { titleIdx, fmEnd } = frontmatterRegion(lines)
  const stripped = lines.filter((line, idx) => {
    if (idx <= titleIdx || idx >= fmEnd) {
      return true
    }
    const m: RegExpExecArray | null = FIELD_PREFIX_RE.exec(line)
    return !(m && fieldKeys.has((m[1] ?? '').trim().toLowerCase()))
  })
  return insertAfterTitle(stripped, renderFrontmatter(newFm))
}

function replaceInlineFields(
  lines: readonly string[],
  newFm: Frontmatter,
  format: FrontmatterFormat,
): string {
  const fieldMap = new Map(newFm.fields.map(([k, v]) => [k.toLowerCase(), { key: k, value: v }]))
  let found = false
  const newLines = lines.map((line) => {
    const m: RegExpExecArray | null = FIELD_PREFIX_RE.exec(line)
    if (!m) {
      return line
    }
    const entry = fieldMap.get((m[1] ?? '').trim().toLowerCase())
    if (!entry) {
      return line
    }
    found = true
    return `${entry.key}: ${entry.value}`
  })
  if (!found) {
    const rendered = format === 'inline' ? renderFrontmatterInline(newFm) : renderFrontmatter(newFm)
    return insertAfterTitle(lines, rendered)
  }
  return newLines.join('\n')
}

export function spliceFrontmatter(
  rawMd: string,
  newFm: Frontmatter,
  format: FrontmatterFormat = 'any',
): string {
  const lines = rawMd.split(LINE_SPLIT_RE)
  const block = findFirstPipeBlock(lines)
  const hasPipe = block !== null
  const targetPipe = format === 'pipe-table' || (format === 'any' && hasPipe)

  if (targetPipe) {
    if (hasPipe && block) {
      return replacePipeBlock(lines, block, renderFrontmatter(newFm))
    }
    return convertInlineToPipe(lines, newFm)
  }
  if (hasPipe && block) {
    return replacePipeBlock(lines, block, renderFrontmatterInline(newFm))
  }
  return replaceInlineFields(lines, newFm, format)
}

export function spliceQTable(rawMd: string, newRows: readonly QTableRow[]): string {
  const lines = rawMd.split(LINE_SPLIT_RE)
  const block = findQTableBlock(lines)
  const rendered = renderQTable(newRows)

  if (!block) {
    if (rendered.length === 0) {
      return rawMd
    }
    throw new Error('qtable_anchor_missing: cannot splice into spec without existing Q-table')
  }
  const before = lines.slice(0, block.start)
  const after = lines.slice(block.end)
  const renderedLines = rendered.length === 0 ? [] : rendered.split('\n')
  return [...before, ...renderedLines, ...after].join('\n')
}

function findPhaseBlock(lines: readonly string[], priority: Priority): BlockRange | null {
  const heading = `## ${priority}`
  let start = -1
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (line === undefined) {
      continue
    }
    if (
      line.startsWith(heading) &&
      (line.length === heading.length || line[heading.length] === ' ')
    ) {
      start = i
      break
    }
  }
  if (start === -1) {
    return null
  }
  let end = start + 1
  while (end < lines.length) {
    const line = lines[end]
    if (line === undefined) {
      break
    }
    if (line.startsWith('## ')) {
      break
    }
    end += 1
  }
  return { start, end }
}

export function spliceTasksFile(
  rawMd: string,
  parsed: ParsedTasks,
  format: FrontmatterFormat = 'any',
): string {
  let out = spliceFrontmatter(rawMd, parsed.frontmatter, format)
  for (const priority of PRIORITIES) {
    out = splicePhase(out, priority, parsed.phases[priority])
  }
  return out
}

function renderPhaseBody(
  heading: string,
  items: readonly { checked: boolean; text: string; isHumanGate: boolean }[],
  preserved: readonly string[],
): string[] {
  const rendered: string[] = [heading, '']
  for (const line of preserved) {
    rendered.push(line)
  }
  if (preserved.length > 0) {
    rendered.push('')
  }
  for (const item of items) {
    rendered.push(renderTaskItem(item))
  }
  rendered.push('')
  return rendered
}

function splicePhase(
  rawMd: string,
  priority: Priority,
  items: readonly { checked: boolean; text: string; isHumanGate: boolean }[],
): string {
  const lines = rawMd.split(LINE_SPLIT_RE)
  const block = findPhaseBlock(lines, priority)
  if (!block) {
    if (items.length === 0) {
      return rawMd
    }
    const rendered = renderPhaseBody(`## ${priority}`, items, [])
    const trimmed = rawMd.replace(TRAILING_NEWLINES_RE, '\n')
    return `${trimmed}\n${rendered.join('\n')}`.replace(COLLAPSE_BLANK_RE, '\n\n')
  }
  const before = lines.slice(0, block.start)
  const after = lines.slice(block.end)
  const heading = lines[block.start] ?? `## ${priority}`
  const preserved = lines.slice(block.start + 1, block.end).filter((line) => {
    const t = line.trim()
    return t.length > 0 && !TASK_ITEM_RE.test(line)
  })
  const rendered = renderPhaseBody(heading, items, preserved)
  return [...before, ...rendered, ...after].join('\n').replace(COLLAPSE_BLANK_RE, '\n\n')
}

export function spliceSpecFile(
  rawMd: string,
  parsed: ParsedSpec,
  format: FrontmatterFormat = 'any',
): string {
  let out = spliceFrontmatter(rawMd, parsed.frontmatter, format)
  if (parsed.qTable.length > 0) {
    out = spliceQTable(out, parsed.qTable)
  }
  return out
}
