import { PathService } from "../notes/path-service";

export class RepairService {
  constructor(private readonly paths: PathService) {}

  hasAnnualStructure(content: string, date: Date): boolean {
    const lines = splitLines(content);
    if (!content.trim() || !lines.some((line) => /^#\s+/.test(line))) return false;
    return Array.from({ length: 12 }, (_, index) => new Date(this.paths.operationalYear(date), index, 1)).every((monthDate) =>
      lines.some((line) => matchesMonthHeading(line, this.paths.dateInfo(monthDate).monthName)),
    );
  }

  hasMonthlyStructure(content: string, date: Date): boolean {
    const info = this.paths.dateInfo(date);
    const lines = splitLines(content);
    if (!content.trim() || !lines.some((line) => /^#\s+/.test(line))) return false;
    const daysInMonth = new Date(info.year, info.month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      if (!lines.some((line) => matchesDayHeading(line, String(day).padStart(2, "0")))) return false;
    }
    return true;
  }

  hasWeeklyStructure(content: string, date: Date): boolean {
    const lines = splitLines(content);
    if (!content.trim() || !lines.some((line) => /^#\s+/.test(line))) return false;
    for (const current of this.paths.weekDates(date)) {
      if (!lines.some((line) => matchesDayHeading(line, String(current.getDate()).padStart(2, "0")))) return false;
    }
    return true;
  }

  repairAnnualLog(content: string, date: Date): string {
    if (this.hasAnnualStructure(content, date)) return content;
    const lines = splitLines(content);
    const byMonth = new Map<string, string[]>(MONTH_NAMES.map((month) => [month, []]));
    const recovered: string[] = [];
    const firstSection = lines.findIndex((line) => /^##\s+/.test(line));
    addBlocks(recovered, taskBlocksInRange(lines, 0, firstSection === -1 ? lines.length : firstSection));

    for (let index = 0; index < lines.length; index += 1) {
      if (!/^##\s+/.test(lines[index])) continue;
      const end = sectionEnd(lines, index);
      const blocks = taskBlocksInRange(lines, index + 1, end);
      const month = MONTH_NAMES.find((item) => matchesMonthHeading(lines[index], item));
      addBlocks(month ? byMonth.get(month)! : recovered, blocks);
      index = end - 1;
    }

    let repaired = this.paths.renderAnnualLog(date);
    for (let index = 0; index < 12; index += 1) {
      const monthDate = new Date(this.paths.operationalYear(date), index, 1);
      const monthName = this.paths.dateInfo(monthDate).monthName;
      repaired = insertBlocksIntoSection(repaired, (line) => matchesMonthHeading(line, monthName), byMonth.get(monthName) ?? []);
    }
    return appendRecovered(repaired, recovered);
  }

  repairMonthlyLog(content: string, date: Date): string {
    if (this.hasMonthlyStructure(content, date)) return content;
    const info = this.paths.dateInfo(date);
    const daysInMonth = new Date(info.year, info.month, 0).getDate();
    const lines = splitLines(content);
    const byDay = new Map<string, string[]>();
    for (let day = 1; day <= daysInMonth; day += 1) byDay.set(String(day).padStart(2, "0"), []);
    const recovered: string[] = [];
    const firstSection = lines.findIndex((line) => /^##\s+/.test(line));
    addBlocks(recovered, taskBlocksInRange(lines, 0, firstSection === -1 ? lines.length : firstSection));

    for (let index = 0; index < lines.length; index += 1) {
      if (!/^##\s+/.test(lines[index])) continue;
      const end = sectionEnd(lines, index);
      const blocks = taskBlocksInRange(lines, index + 1, end);
      const day = [...byDay.keys()].find((item) => matchesDayHeading(lines[index], item));
      addBlocks(day ? byDay.get(day)! : recovered, blocks);
      index = end - 1;
    }

    let repaired = this.paths.renderMonthlyLog(date);
    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = String(day).padStart(2, "0");
      repaired = insertBlocksIntoSection(repaired, (line) => matchesDayHeading(line, key), byDay.get(key) ?? []);
    }
    return appendRecovered(repaired, recovered);
  }

  repairWeeklyLog(content: string, date: Date): string {
    if (this.hasWeeklyStructure(content, date)) return content;
    const lines = splitLines(content);
    const byDay = new Map<string, string[]>();
    for (const current of this.paths.weekDates(date)) {
      byDay.set(String(current.getDate()).padStart(2, "0"), []);
    }
    const recovered: string[] = [];
    const firstSection = lines.findIndex((line) => /^##\s+/.test(line));
    addBlocks(recovered, taskBlocksInRange(lines, 0, firstSection === -1 ? lines.length : firstSection));

    for (let index = 0; index < lines.length; index += 1) {
      if (!/^##\s+/.test(lines[index])) continue;
      const end = sectionEnd(lines, index);
      const blocks = taskBlocksInRange(lines, index + 1, end);
      const day = [...byDay.keys()].find((item) => matchesDayHeading(lines[index], item));
      addBlocks(day ? byDay.get(day)! : recovered, blocks);
      index = end - 1;
    }

    let repaired = this.paths.renderWeeklyLog(date);
    for (const day of byDay.keys()) {
      repaired = insertBlocksIntoSection(repaired, (line) => matchesDayHeading(line, day), byDay.get(day) ?? []);
    }
    return appendRecovered(repaired, recovered);
  }

  repairDailyLog(content: string, _date: Date): string {
    return content.trim() ? content : this.paths.renderDailyLog(_date);
  }
}

const MONTH_NAMES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

export function splitLines(content: string): string[] {
  return String(content || "").split(/\r?\n/);
}

export function sectionEnd(lines: string[], start: number): number {
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index])) return index;
  }
  return lines.length;
}

export function taskBlocksInRange(lines: string[], start: number, end: number): string[] {
  const blocks: string[] = [];
  let index = start;
  while (index < end) {
    const line = String(lines[index] || "");
    if (!/^- \[[^\]]+\]\s*\S/.test(line)) {
      index += 1;
      continue;
    }
    const block = [line];
    let next = index + 1;
    while (next < end) {
      const child = String(lines[next] || "");
      if (!child.trim() || /^#{1,6}\s+/.test(child) || /^- \[[^\]]+\]/.test(child)) break;
      block.push(child);
      next += 1;
    }
    blocks.push(block.join("\n"));
    index = next;
  }
  return blocks;
}

export function insertBlocksIntoSection(content: string, predicate: (line: string) => boolean, blocks: string[]): string {
  if (!blocks.length) return content;
  const lines = splitLines(content);
  const start = lines.findIndex(predicate);
  if (start === -1) return content;
  const end = sectionEnd(lines, start);
  let at = start + 1;
  while (at < end && !lines[at].trim()) at += 1;
  lines.splice(at, 0, ...blocks, "");
  return lines.join("\n");
}

export function appendRecovered(content: string, blocks: string[]): string {
  if (!blocks.length) return content;
  return `${content.trimEnd()}\n\n## Recuperados\n${blocks.join("\n")}\n`;
}

function addBlocks(target: string[], blocks: string[]): void {
  const seen = new Set(target);
  for (const block of blocks) {
    if (seen.has(block)) continue;
    seen.add(block);
    target.push(block);
  }
}

function matchesMonthHeading(line: string, monthName: string): boolean {
  const month = normalizeText(monthName).toUpperCase();
  const normalizedLine = normalizeText(line).toUpperCase();
  const aliasRe = new RegExp(`^##\\s+\\[\\[[^\\]]+\\|${escapeRegExp(month)}\\]\\]\\s*$`);
  return normalizedLine.startsWith(`## ${month}`) || aliasRe.test(normalizedLine);
}

function matchesDayHeading(line: string, day: string): boolean {
  const normalizedLine = normalizeText(line).toUpperCase();
  const oldRe = new RegExp(`^##\\s+${escapeRegExp(day)}\\b`);
  const aliasRe = new RegExp(`^##\\s+\\[\\[[^\\]]+\\|${escapeRegExp(day)}(?:\\s+-|\\]\\])`);
  return oldRe.test(normalizedLine) || aliasRe.test(normalizedLine);
}

function normalizeText(value: string): string {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeRegExp(value: string): string {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
