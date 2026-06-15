import { formatDate } from "../notes/path-service";
import { metadataDate, sectionBounds, taskKey, taskLooseKey, type TaskBlock } from "./task-parser";

const RECURRENCE_RE = /\s*🔁\s*every\b.*?(?=\s+(?:🏁|➕|🛫|⏳|📅|❌|✅|#[\w/-]+|\^[\w-]+)|$)/iu;

export function toOpenTask(task: TaskBlock | string): string {
  const line = typeof task === "string" ? task : task.line;
  return withTaskStatus(line, " ");
}

export function withTaskStatus(line: string, status: string): string {
  return line.replace(/^(\s*)- \[[^\]]+\]/, `$1- [${status}]`);
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
  return withOccurrenceDate(stripRecurrence(toOpenTask(task)), date);
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

export function markMigratedInSection(content: string, heading: string | RegExp | ((line: string) => boolean), tasks: TaskBlock[]): string {
  return replaceTasks(content, heading, tasks, markMigrated);
}

export function markMigratedInRoot(content: string, tasks: TaskBlock[]): string {
  return tasks.reduce((current, task) => current.replace(task.line, markMigrated(task.line)), content);
}

export function insertAfterH1(content: string, linesToInsert: string[]): string {
  if (!linesToInsert.length) return content;
  const lines = String(content || "").split(/\r?\n/);
  const index = lines.findIndex((line) => /^#\s+/.test(line));
  if (index === -1) return `${linesToInsert.join("\n")}\n\n${content}`;
  let at = index + 1;
  while (at < lines.length && lines[at].trim() === "") at += 1;
  lines.splice(at, 0, ...linesToInsert, "");
  return lines.join("\n");
}

export function insertIntoSection(content: string, heading: string | RegExp | ((line: string) => boolean), linesToInsert: string[]): string {
  if (!linesToInsert.length) return content;
  const lines = String(content || "").split(/\r?\n/);
  const bounds = sectionBounds(content, heading);
  if (!bounds) throw new Error("Secao de log nao encontrada para inserir tarefas.");
  let at = bounds[0] + 1;
  while (at < bounds[1] && lines[at].trim() === "") at += 1;
  lines.splice(at, 0, ...linesToInsert, "");
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
