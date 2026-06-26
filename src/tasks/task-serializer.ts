import { formatDate } from "../notes/path-service";
import { metadataDate, sectionBounds, taskKey, taskLooseKey, type TaskBlock } from "./task-parser";

const CARRYABLE_STATUSES = new Set([" ", "/"]);

const RECURRENCE_RE = /\s*🔁\s*every\b.*?(?=\s+(?:🏁|➕|🛫|⏳|📅|❌|✅|#[\w/-]+|\^[\w-]+)|$)/iu;

const TIME_MARKER_RE = /\s*⏰\s*\d{1,2}:\d{2}/u;

export function withCreatedDate(line: string, date: Date): string {
  return replaceOrAppendDate(line, "➕", date);
}

export function withDoneDate(line: string, date: Date): string {
  return replaceOrAppendDate(line, "✅", date);
}

export function toOpenTask(task: TaskBlock | string): string {
  const line = typeof task === "string" ? task : task.line;
  return withTaskStatus(line, " ");
}

export function withTaskStatus(line: string, status: string): string {
  return line.replace(/^(\s*)- \[[^\]]+\]/, `$1- [${status}]`);
}

export function hasTimeMarker(line: string): boolean {
  return TIME_MARKER_RE.test(line);
}

export function extractTimeMarker(line: string): string {
  const match = String(line).match(TIME_MARKER_RE);
  return match ? match[0] : "";
}

export function preserveTimeMarker(original: string, processed: string): string {
  if (hasTimeMarker(processed)) return processed;
  const marker = extractTimeMarker(original);
  if (!marker) return processed;
  if (/#\w/u.test(processed)) return processed.replace(/\s(#\w)/u, `${marker} $1`);
  return `${processed}${marker}`;
}

export function stripRecurrence(line: string): string {
  return String(line).replace(RECURRENCE_RE, "").replace(/\s+/g, " ").trimEnd();
}

export function withOccurrenceDate(line: string, date: Date, marker = occurrenceMarker(line)): string {
  return replaceOrAppendDate(line, marker, date);
}

export function withDueDate(line: string, date: Date): string {
  return replaceOrAppendDate(line, "📅", date);
}

export function prepareRecurringTask(task: TaskBlock, date: Date): string {
  return preserveTimeMarker(task.line, stripMarker(withOccurrenceDate(stripRecurrence(toOpenTask(task)), date)));
}

export function uniqueNewTasks(existing: TaskBlock[], incoming: TaskBlock[]): TaskBlock[] {
  const keys = new Set(existing.map(taskKey));
  return incoming.filter((task) => {
    const key = taskKey(task);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

export function uniqueNewPreparedTasks(existing: TaskBlock[], incoming: string[]): string[] {
  const keys = new Set(existing.map(taskKey));
  return incoming.filter((line) => {
    const key = taskKey(line);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

export function markMigrated(line: string): string {
  return withTaskStatus(line, ">");
}

export function markCancelled(line: string): string {
  return withTaskStatus(line, "-");
}

export function prepareMigratedBlock(block: string): string {
  const lines = String(block || "").split(/\r?\n/);
  const prepared: string[] = [];
  let keepFollowingText = false;
  let originalStatus = " ";
  for (const [index, line] of lines.entries()) {
    if (index === 0) {
      const match = line.match(/^(\s*)-\s+\[([^\]])\]/);
      originalStatus = match?.[2] ?? " ";
      prepared.push(originalStatus === "/" ? withTaskStatus(line, "/") : toOpenTask(line));
      keepFollowingText = true;
      continue;
    }
    const match = line.match(/^(\s*)-\s+\[([^\]])\]/);
    if (match) {
      keepFollowingText = CARRYABLE_STATUSES.has(match[2]);
      if (keepFollowingText) prepared.push(toOpenTask(line));
      continue;
    }
    if (keepFollowingText && /^\s+/.test(line)) prepared.push(line);
  }
  return prepared.join("\n");
}

export function prepareForwardableMigratedBlock(block: string): string {
  const lines = String(block || "").split(/\r?\n/);
  const prepared: string[] = [];
  let keepFollowingText = false;
  for (const [index, line] of lines.entries()) {
    if (index === 0) {
      prepared.push(preserveTimeMarker(line, stripMarker(toOpenTask(line))));
      keepFollowingText = true;
      continue;
    }
    const match = line.match(/^(\s*)-\s+\[([^\]])\]/);
    if (match) {
      keepFollowingText = CARRYABLE_STATUSES.has(match[2]);
      if (keepFollowingText) prepared.push(preserveTimeMarker(line, stripMarker(toOpenTask(line))));
      continue;
    }
    if (keepFollowingText && /^\s+/.test(line)) prepared.push(line);
  }
  return prepared.join("\n");
}

export function prepareForwardableMigratedBlockPreservingStatus(block: string, originalStatus: string): string {
  const lines = String(block || "").split(/\r?\n/);
  const prepared: string[] = [];
  let keepFollowingText = false;
  for (const [index, line] of lines.entries()) {
    if (index === 0) {
      prepared.push(preserveTimeMarker(line, stripMarker(withTaskStatus(line, originalStatus))));
      keepFollowingText = true;
      continue;
    }
    const match = line.match(/^(\s*)-\s+\[([^\]])\]/);
    if (match) {
      keepFollowingText = CARRYABLE_STATUSES.has(match[2]);
      if (keepFollowingText) prepared.push(preserveTimeMarker(line, stripMarker(withTaskStatus(line, match[2]))));
      continue;
    }
    if (keepFollowingText && /^\s+/.test(line)) prepared.push(line);
  }
  return prepared.join("\n");
}

export function markEphemeralCancelledTaskBlockInContent(content: string, task: TaskBlock): string {
  const lines = String(content || "").split(/\r?\n/);
  const start = lines.findIndex((line) => line === task.line);
  if (start === -1) return content;
  const parentIndent = task.line.match(/^\s*/)?.[0].length ?? 0;
  lines[start] = markCancelled(lines[start]);
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^(\s*)-\s+\[([^\]])\]/);
    if (match && match[1].length <= parentIndent) break;
    if (/^#{1,6}\s+/.test(line)) break;
    if (match && CARRYABLE_STATUSES.has(match[2])) lines[index] = markCancelled(line);
  }
  return lines.join("\n");
}

export function stripMarker(line: string): string {
  return String(line).replace(/\s*🔚/gu, "").replace(/\s*🔜/gu, "").replace(/ {2,}/g, " ").trimEnd();
}

export function markMigratedTaskBlockInContent(content: string, task: TaskBlock): string {
  const lines = String(content || "").split(/\r?\n/);
  const start = lines.findIndex((line) => line === task.line);
  if (start === -1) return content;
  const parentIndent = task.line.match(/^\s*/)?.[0].length ?? 0;
  lines[start] = markMigrated(lines[start]);
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^(\s*)-\s+\[([^\]])\]/);
    if (match && match[1].length <= parentIndent) break;
    if (/^#{1,6}\s+/.test(line)) break;
    if (match && CARRYABLE_STATUSES.has(match[2])) lines[index] = markMigrated(line);
  }
  return lines.join("\n");
}

export function markOpenChildrenOfMigratedBlocks(content: string): string {
  const lines = String(content || "").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const parent = lines[index].match(/^-\s+\[([^\]])\]/);
    if (!parent || parent[1] !== ">") continue;
    for (let child = index + 1; child < lines.length; child += 1) {
      if (/^- \[[^\]]+\]/.test(lines[child]) || /^#{1,6}\s+/.test(lines[child])) break;
      if (/^\s+-\s+\[( |\/)\]/.test(lines[child])) lines[child] = markMigrated(lines[child]);
    }
  }
  return lines.join("\n");
}

export function removeMigratedChildrenFromOpenBlocks(content: string): string {
  const lines = String(content || "").split(/\r?\n/);
  const output: string[] = [];
  let dropping = false;
  let droppedIndent = 0;
  for (const line of lines) {
    const root = line.match(/^-\s+\[([^\]])\]/);
    const child = line.match(/^(\s+)-\s+\[([^\]])\]/);
    const heading = /^#{1,6}\s+/.test(line);
    if (root || heading || !line.trim()) dropping = false;
    if (dropping) {
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (indent > droppedIndent) continue;
      dropping = false;
    }
    if (child?.[2] === ">") {
      dropping = true;
      droppedIndent = child[1].length;
      continue;
    }
    output.push(line);
  }
  return output.join("\n");
}


export function markMigratedInSection(content: string, heading: string | RegExp | ((line: string) => boolean), tasks: TaskBlock[]): string {
  return replaceTasks(content, heading, tasks, markMigrated);
}

export function markMigratedInRoot(content: string, tasks: TaskBlock[]): string {
  return tasks.reduce((current, task) => current.replace(task.line, markMigrated(task.line)), content);
}

export function insertAfterH1(content: string, linesToInsert: string[]): string {
  if (!linesToInsert.length) return content;
  const lines = String(content || "").split(/\r?\n/);
  const separated = separateTaskBlocks(linesToInsert);
  const index = lines.findIndex((line) => /^#\s+/.test(line));
  if (index === -1) return `${separated.join("\n")}\n\n${content}`;
  let at = index + 1;
  while (at < lines.length && lines[at].trim() === "") at += 1;
  lines.splice(at, 0, ...separated, "");
  return lines.join("\n");
}

export function insertIntoSection(content: string, heading: string | RegExp | ((line: string) => boolean), linesToInsert: string[]): string {
  if (!linesToInsert.length) return content;
  const lines = String(content || "").split(/\r?\n/);
  const separated = separateTaskBlocks(linesToInsert);
  const bounds = sectionBounds(content, heading);
  if (!bounds) throw new Error("Secao de log nao encontrada para inserir tarefas.");
  let at = bounds[0] + 1;
  while (at < bounds[1] && lines[at].trim() === "") at += 1;
  lines.splice(at, 0, ...separated, "");
  return lines.join("\n");
}

export function replaceTaskInSection(content: string, heading: string | RegExp | ((line: string) => boolean), task: TaskBlock, replacement: string): string {
  const bounds = sectionBounds(content, heading);
  if (!bounds) return content;
  const lines = String(content || "").split(/\r?\n/);
  for (let index = bounds[0]; index < bounds[1]; index += 1) {
    if (lines[index] === task.line) lines[index] = replacement;
  }
  return lines.join("\n");
}

export function replaceTaskInRoot(content: string, task: TaskBlock, replacement: string): string {
  return content.replace(task.line, replacement);
}

export function uniqueNewTasksForSection(content: string, heading: string | RegExp | ((line: string) => boolean), incoming: string[]): string[] {
  const bounds = sectionBounds(content, heading);
  const existingText = bounds ? content.split(/\r?\n/).slice(bounds[0], bounds[1]).join("\n") : "";
  const keys = new Set(existingText.split(/\r?\n/).map(taskKey));
  return incoming.filter((line) => {
    const key = taskKey(line);
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

export function replaceTaskInSectionByLooseKey(content: string, heading: string | RegExp | ((line: string) => boolean), replacementTask: string): string {
  const key = taskLooseKey(replacementTask);
  if (!key) return content;
  const lines = String(content || "").split(/\r?\n/);
  const bounds = sectionBounds(content, heading);
  if (!bounds) return content;
  for (let index = bounds[0] + 1; index < bounds[1]; index += 1) {
    const match = lines[index].match(/^- \[([^\]]+)\]/);
    if (!match || taskLooseKey(lines[index]) !== key) continue;
    lines[index] = withTaskStatus(replacementTask, match[1]);
    return lines.join("\n");
  }
  return content;
}

export function normalizeRootTaskSpacing(content: string): string {
  return normalizeLogSpacing(content);
}

export function normalizeLogSpacing(content: string): string {
  const normalized = String(content || "");
  const lines = normalized.split(/\r?\n/);
  const output: string[] = [];
  for (const line of lines) {
    const previous = previousNonEmpty(output);
    if ((isRootTask(line) || isHeading(line)) && output.length && output[output.length - 1] !== "" && isTaskBlockLine(previous)) {
      output.push("");
    }
    output.push(line);
  }
  const result = output.join("\n");
  return normalized.endsWith("\n") && !result.endsWith("\n") ? `${result}\n` : result;
}

function replaceTasks(
  content: string,
  heading: string | RegExp | ((line: string) => boolean),
  tasks: TaskBlock[],
  transform: (line: string) => string,
): string {
  return tasks.reduce((current, task) => replaceTaskInSection(current, heading, task, transform(task.line)), content);
}

function replaceOrAppendDate(line: string, marker: string, date: Date): string {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}\\s*\\d{4}-\\d{2}-\\d{2}`, "u");
  const value = `${marker} ${formatDate(date)}`;
  if (re.test(line)) return line.replace(re, value);
  if (/[✅❌]/u.test(line)) return line.replace(/([✅❌])/u, `${value} $1`);
  if (/#\w/u.test(line)) return line.replace(/(#\w)/u, `${value} $1`);
  if (/\^[\w-]+/u.test(line)) return line.replace(/(\^[\w-]+)/u, `${value} $1`);
  return `${line} ${value}`;
}

function occurrenceMarker(line: string): string {
  if (metadataDate(line, "📅")) return "📅";
  if (metadataDate(line, "⏳")) return "⏳";
  if (metadataDate(line, "🛫")) return "🛫";
  return "📅";
}

function separateTaskBlocks(lines: string[]): string[] {
  return lines.flatMap((line, index) => (index === 0 ? [line] : ["", line]));
}

function isRootTask(line: string): boolean {
  return /^- \[[^\]]+\]/.test(line);
}

function isTaskBlockLine(line: string): boolean {
  return /^- \[[^\]]+\]/.test(line) || /^\s+/.test(line);
}

function isHeading(line: string): boolean {
  return /^#{1,6}\s+/.test(line);
}

function previousNonEmpty(lines: string[]): string {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim()) return lines[index];
  }
  return "";
}
