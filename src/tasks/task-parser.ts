import { addDays, formatDate, normalizeText, parseDate, sameDate } from "../notes/path-service";

export interface TaskBlock {
  line: string;
  block: string;
  status: string;
  text: string;
  indent: string;
}

const TASK_RE = /^(\s*)-\s+\[([^\]])\]\s+(.*)$/;
const RECURRENCE_RE = /\s*🔁\s*every\b.*?(?=\s+(?:🏁|➕|🛫|⏳|📅|❌|✅|#[\w/-]+|\^[\w-]+)|$)/iu;

export function taskMatch(line: string): RegExpMatchArray | null {
  return line.match(TASK_RE);
}

export function extractTasks(content: string): TaskBlock[] {
  return content
    .split(/\r?\n/)
    .filter((line) => TASK_RE.test(line))
    .map((line) => {
      const match = line.match(TASK_RE)!;
      return { line, block: line, indent: match[1], status: match[2], text: match[3] };
    })
    .filter(isUsefulTask);
}

export function extractTasksWithSubtasks(content: string): TaskBlock[] {
  const lines = content.split(/\r?\n/);
  const tasks: TaskBlock[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(TASK_RE);
    if (!match) continue;
    if (match[1].length > 0) continue;
    const block = [lines[index]];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (TASK_RE.test(lines[next]) && indentation(lines[next]) <= indentation(lines[index])) break;
      if (/^\s+/.test(lines[next]) && !/^\s*-\s+\[[x-]\]/i.test(lines[next])) block.push(lines[next]);
    }
    tasks.push({ line: lines[index], block: block.join("\n"), indent: match[1], status: match[2], text: match[3] });
  }
  return tasks.filter(isUsefulTask);
}

export function extractRecurringTasks(content: string): TaskBlock[] {
  return extractTasksWithSubtasks(content).filter((task) => /🔁\s*every/i.test(task.block));
}

export function extractRootTasks(content: string): TaskBlock[] {
  return extractTasksWithSubtasks(content).filter((task) => !task.indent);
}

export function extractSectionTasks(content: string, heading: string | RegExp | ((line: string) => boolean)): TaskBlock[] {
  return extractTasksWithSubtasks(sectionText(content, heading));
}

export function sectionBounds(content: string, heading: string | RegExp | ((line: string) => boolean)): [number, number] | null {
  const lines = content.split(/\r?\n/);
  const matcher =
    typeof heading === "function"
      ? heading
      : typeof heading === "string"
        ? (line: string) => normalizeText(line).toUpperCase() === normalizeText(heading).toUpperCase()
        : (line: string) => heading.test(line);
  const start = lines.findIndex(matcher);
  if (start === -1) return null;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,6}\s+/.test(lines[index])) return [start, index];
  }
  return [start, lines.length];
}

export function rootSectionBounds(content: string): [number, number] {
  const lines = content.split(/\r?\n/);
  const firstHeading = lines.findIndex((line, index) => index > 0 && /^#{1,6}\s+/.test(line));
  return [0, firstHeading === -1 ? lines.length : firstHeading];
}

export function sectionText(content: string, heading: string | RegExp | ((line: string) => boolean)): string {
  const bounds = sectionBounds(content, heading);
  if (!bounds) return "";
  return content.split(/\r?\n/).slice(bounds[0] + 1, bounds[1]).join("\n");
}

export function rootText(content: string): string {
  const [start, end] = rootSectionBounds(content);
  return content.split(/\r?\n/).slice(start, end).join("\n");
}

export function isUsefulTask(task: TaskBlock): boolean {
  return Boolean(task.text.trim()) && !["x", "-"].includes(task.status);
}

export function isOpenTask(task: TaskBlock): boolean {
  return task.status === " " && Boolean(task.text.trim());
}

export function taskKey(taskOrText: TaskBlock | string): string {
  return normalizedTaskKey(typeof taskOrText === "string" ? taskOrText : taskOrText.line, false);
}

export function taskLooseKey(taskOrText: TaskBlock | string): string {
  return normalizedTaskKey(typeof taskOrText === "string" ? taskOrText : taskOrText.line, true);
}

export function metadataDate(text: string, marker: string): Date | null {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}\\s*(\\d{4}-\\d{2}-\\d{2})`, "u"));
  return match ? parseDate(match[1]) : null;
}

export function occurrenceMarker(text: string): Date | null {
  return metadataDate(text, "🗓️") ?? metadataDate(text, "🗓");
}

export function hasScheduledDate(text: string): boolean {
  return /⏳\s*\d{4}-\d{2}-\d{2}/u.test(text);
}

export function isScheduledForDate(text: string, date: Date): boolean {
  const scheduled = scheduledDate(text);
  return scheduled ? sameDate(scheduled, date) || scheduled < addDays(date, 1) : true;
}

export function dueDate(text: string): Date | null {
  return metadataDate(text, "📅");
}

export function scheduledDate(text: string): Date | null {
  return metadataDate(text, "⏳");
}

export function startDate(text: string): Date | null {
  return metadataDate(text, "🛫");
}

export function firstDateInTask(text: string): Date | null {
  return startDate(text) ?? scheduledDate(text) ?? dueDate(text) ?? occurrenceMarker(text);
}

export function dayPredicate(date: Date): (task: TaskBlock) => boolean {
  return (task) => isScheduledForDate(task.text, date);
}

export function migratedPredicate(task: TaskBlock): boolean {
  return task.status === ">";
}

export function monthPredicate(monthName: string): (line: string) => boolean {
  const normalized = normalizeText(monthName).toUpperCase();
  const aliasRe = new RegExp(`^##\\s+\\[\\[[^\\]]+\\|${escapeRegExp(normalized)}\\]\\]\\s*$`);
  return (line) => {
    const normalizedLine = normalizeText(line).toUpperCase();
    return normalizedLine.startsWith(`## ${normalized}`) || aliasRe.test(normalizedLine);
  };
}

export function dayHeadingPredicate(day: string): (line: string) => boolean {
  const escapedDay = escapeRegExp(day);
  const oldRe = new RegExp(`^##\\s+${escapedDay}\\b`);
  const aliasRe = new RegExp(`^##\\s+\\[\\[[^\\]]+\\|${escapedDay}(?:\\s+-|\\]\\])`);
  return (line) => {
    const normalizedLine = normalizeText(line).toUpperCase();
    return oldRe.test(normalizedLine) || aliasRe.test(normalizedLine);
  };
}

export function migratedHeadingPredicate(line: string): boolean {
  return /^##\s+MIGRADOS\b/i.test(normalizeText(line));
}

export function taskDateText(date: Date): string {
  return formatDate(date);
}

function indentation(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}

function normalizedTaskKey(task: string, removeDateMarkers: boolean): string {
  return firstLine(task)
    .replace(/^\s*-\s*\[[^\]]+\]\s*/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/🆔\s*\S+/g, "")
    .replace(/⛔\s*[\S,]+/g, "")
    .replace(/🏁\s*\S+/g, "")
    .replace(/➕\s*\d{4}-\d{2}-\d{2}/g, "")
    .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, removeDateMarkers ? "" : "📅")
    .replace(/🛫\s*\d{4}-\d{2}-\d{2}/g, removeDateMarkers ? "" : "🛫")
    .replace(/⏳\s*\d{4}-\d{2}-\d{2}/g, removeDateMarkers ? "" : "⏳")
    .replace(/[✅❌]\s*\d{4}-\d{2}-\d{2}/g, "")
    .replace(RECURRENCE_RE, "")
    .replace(/#[\w/-]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function firstLine(block: string): string {
  return String(block || "").split(/\r?\n/)[0];
}

function escapeRegExp(value: string): string {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
