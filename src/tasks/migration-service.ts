import type { CascadeSettings } from "../config/schema";
import type { LogService } from "../logging/log-service";
import { addDays } from "../notes/path-service";
import { FileService } from "../vault/file-service";
import { LockService } from "../vault/lock-service";
import { PathService } from "../notes/path-service";
import {
  dayHeadingPredicate,
  extractRecurringTasks,
  extractRootTasks,
  extractSectionTasks,
  extractTasksWithSubtasks,
  isEphemeralTask,
  isOpenTask,
  metadataDate,
  migratedHeadingPredicate,
  monthPredicate,
  scheduledDate,
  startDate,
  taskLooseKey,
  type TaskBlock,
} from "./task-parser";
import { RecurrenceService } from "./recurrence-service";
import {
  insertIntoSection,
  markCancelled,
  markEphemeralCancelledTaskBlockInContent,
  markMigrated,
  markMigratedTaskBlockInContent,
  markOpenChildrenOfMigratedBlocks,
  normalizeLogSpacing as normalizeLogTextSpacing,
  prepareForwardableMigratedBlock,
  prepareForwardableMigratedBlockPreservingStatus,
  removeMigratedChildrenFromOpenBlocks,
  prepareRecurringTask,
  uniqueNewPreparedTasks,
} from "./task-serializer";

export class MigrationService {
  constructor(
    private readonly settings: CascadeSettings,
    private readonly files: FileService,
    private readonly paths: PathService,
    private readonly recurrence: RecurrenceService,
    private readonly lock: LockService,
    private readonly log: LogService,
  ) {}

  async run(date = new Date()): Promise<void> {
    if (!this.settings.migrationEnabled) return;
    await this.lock.runExclusive(async () => {
      this.log.migration.info("Migration begin");
      await this.processLostPeriods(date);
      await this.ensureCascadeFiles(date);
      if (this.settings.yearlyEnabled) {
        await this.seedAnnualFromRecurring(date);
        if (this.settings.monthlyEnabled) {
          await this.ensureMonthly(date);
          await this.migrateAnnualToMonthly(date);
          await this.seedMonthlyRecurring(date);
        } else {
          await this.seedRecurringToWeeklyOrDaily(date);
        }
      } else {
        await this.seedRecurringToMonthly(date);
      }
      await this.migrateMonthlyToDaily(date);
      await this.migratePreviousDays(date);
      await this.removeFutureScheduledFromDaily(date);
      await this.normalizeLogSpacing(date);
      this.log.migration.info("Migration complete");
    });
  }

  private async processLostPeriods(date: Date): Promise<void> {
    const days = Math.max(0, Math.floor(this.settings.previousDayMigrationLookbackDays));
    if (!days) return;

    const processedMonths = new Set<string>();
    const processedWeeks = new Set<string>();

    for (let offset = days; offset >= 1; offset -= 1) {
      const past = addDays(date, -offset);

      if (this.settings.monthlyEnabled) {
        const monthKey = `${past.getFullYear()}-${past.getMonth()}`;
        if (!processedMonths.has(monthKey)) {
          processedMonths.add(monthKey);
          await this.ensureMonthly(past);
          if (this.settings.yearlyEnabled) await this.migrateAnnualToMonthly(past);
        }
      }

      if (this.paths.weeklyEnabled()) {
        const weekPath = this.paths.weeklyPath(past);
        if (!processedWeeks.has(weekPath)) {
          processedWeeks.add(weekPath);
          await this.files.ensureFile(weekPath, this.paths.renderWeeklyLog(past));
        }
      }

      await this.ensureDayCascade(past);
    }
  }

  private async ensureDayCascade(date: Date): Promise<void> {
    const dailyPath = this.paths.dailyPath(date);
    const existing = await this.files.read(dailyPath);
    if (!existing) {
      await this.files.write(dailyPath, this.paths.renderDailyLog(date));
    }
    await this.migrateMonthlyToDaily(date);
  }

  private async ensureCascadeFiles(date: Date): Promise<void> {
    if (this.settings.yearlyEnabled) await this.files.ensureFile(this.paths.annualPath(date), this.paths.renderAnnualLog(date));
    if (this.settings.monthlyEnabled) await this.files.ensureFile(this.paths.monthlyPath(date), this.paths.renderMonthlyLog(date));
    if (this.paths.weeklyEnabled()) await this.files.ensureFile(this.paths.weeklyPath(date), this.paths.renderWeeklyLog(date));
    await this.files.ensureFile(this.dailyPath(date), this.paths.renderDailyLog(date));
  }

  private async ensureMonthly(date: Date): Promise<void> {
    await this.files.ensureFile(this.paths.monthlyPath(date), this.paths.renderMonthlyLog(date));
  }

  async seedAnnualFromRecurring(date = new Date()): Promise<void> {
    if (!this.settings.recurringTasksPath) return;
    if (!this.settings.yearlyEnabled) {
      await this.seedRecurringToMonthly(date);
      return;
    }
    const recurring = await this.files.read(this.settings.recurringTasksPath);
    const tasks = extractRecurringTasks(recurring);
    const counts = looseKeyCounts(tasks.map((task) => task.line));
    const annualPath = this.paths.annualPath(date);
    let annual = await this.files.read(annualPath);
    for (const task of tasks) {
      for (let index = 0; index < 12; index += 1) {
        const monthDate = new Date(this.paths.operationalYear(date), index, 1);
        if (!this.recurrence.datesInMonthForTask(task.line, monthDate).length) continue;
        const pred = monthPredicate(this.paths.dateInfo(monthDate).monthName);
        if (hasUniqueLooseKey(task.line, counts)) {
          annual = annual.replace(task.line, task.line);
        }
        const unique = uniqueNewPreparedTasks(extractSectionTasks(annual, pred), [task.line]);
        annual = insertIntoSection(annual, pred, unique);
      }
    }
    await this.files.write(annualPath, annual);
  }

  async migrateAnnualToMonthly(date = new Date()): Promise<void> {
    const annualPath = this.paths.annualPath(date);
    const monthlyPath = this.paths.monthlyPath(date);
    const annual = await this.files.read(annualPath);
    let monthly = await this.files.read(monthlyPath);
    const info = this.paths.dateInfo(date);
    const pred = monthPredicate(info.monthName);
    const pending = extractSectionTasks(annual, pred).filter((task) => isOpenTask(task) && !/\bevery\b/i.test(task.line));
    if (!pending.length) return;
    const ephemeral = pending.filter(isEphemeralTask);
    const forwardable = pending.filter((task) => !isEphemeralTask(task));
    const unique = uniqueNewPreparedTasks(
      extractTasksWithSubtasks(monthly),
      forwardable.map((task) =>
        task.status === "/"
          ? prepareForwardableMigratedBlockPreservingStatus(task.block, task.status)
          : prepareForwardableMigratedBlock(task.block),
      ),
    );
    monthly = insertAfterH1Compat(monthly, unique);
    let updatedAnnual = annual;
    for (const task of ephemeral) updatedAnnual = markEphemeralCancelledTaskBlockInContent(updatedAnnual, task);
    for (const task of forwardable) updatedAnnual = markMigratedTaskBlockInContent(updatedAnnual, task);
    await this.files.write(monthlyPath, monthly);
    await this.files.write(annualPath, updatedAnnual);
  }

  async seedMonthlyRecurring(date = new Date()): Promise<void> {
    if (!this.settings.recurringTasksPath) return;
    const source = await this.files.read(this.settings.recurringTasksPath);
    const tasks = extractRecurringTasks(source);
    if (!tasks.length) return;
    const counts = looseKeyCounts(tasks.map((task) => task.line));
    const targetPath = this.paths.weeklyEnabled() ? this.paths.weeklyPath(date) : this.paths.monthlyPath(date);
    let updated = await this.files.read(targetPath);
    for (const task of tasks) {
      for (const occurrence of this.recurrence.datesInMonthForTask(task.line, date)) {
        if (this.paths.weeklyEnabled()) {
          await this.files.ensureFile(this.paths.weeklyPath(occurrence), this.paths.renderWeeklyLog(occurrence));
          if (this.paths.weeklyPath(occurrence) !== targetPath) {
            await this.insertRecurringOccurrence(task, counts, occurrence);
            continue;
          }
        }
        const pred = dayHeadingPredicate(this.paths.dateInfo(occurrence).dd);
        const prepared = prepareRecurringTask(task, occurrence);
        if (hasUniqueLooseKey(task.line, counts)) {
          // Replacement preserves the current task status when the operational copy already exists.
        }
        const unique = uniqueNewPreparedTasks(extractSectionTasks(updated, pred), [prepared]);
        updated = insertIntoSection(updated, pred, unique);
      }
    }
    await this.files.write(targetPath, updated);
    await this.markAnnualRecurringMigrated(date);
  }

  private async seedRecurringToMonthly(date = new Date()): Promise<void> {
    if (!this.settings.recurringTasksPath) return;
    if (this.settings.monthlyEnabled) {
      await this.seedMonthlyRecurring(date);
      return;
    }
    await this.seedRecurringToWeeklyOrDaily(date);
  }

  private async seedRecurringToWeeklyOrDaily(date = new Date()): Promise<void> {
    if (!this.settings.recurringTasksPath) return;
    const source = await this.files.read(this.settings.recurringTasksPath);
    const tasks = extractRecurringTasks(source);
    if (!tasks.length) return;
    const counts = looseKeyCounts(tasks.map((task) => task.line));
    if (this.paths.weeklyEnabled()) {
      for (const task of tasks) {
        for (const occurrence of this.recurrence.datesInMonthForTask(task.line, date)) {
          await this.files.ensureFile(this.paths.weeklyPath(occurrence), this.paths.renderWeeklyLog(occurrence));
          await this.insertRecurringOccurrence(task, counts, occurrence);
        }
      }
    } else {
      await this.seedRecurringToDaily(date, tasks, counts);
    }
  }

  private async seedRecurringToDaily(date: Date, tasks: TaskBlock[], _counts: Map<string, number>): Promise<void> {
    const dailyPath = this.paths.dailyPath(date);
    let daily = await this.files.read(dailyPath);
    for (const task of tasks) {
      for (const occurrence of this.recurrence.datesInMonthForTask(task.line, date)) {
        const prepared = prepareRecurringTask(task, occurrence);
        const unique = uniqueNewPreparedTasks(extractTasksWithSubtasks(daily), [prepared]);
        if (unique.length) daily = insertAfterH1Compat(daily, unique);
      }
    }
    await this.files.write(dailyPath, daily);
  }

  async migrateMonthlyToDaily(date = new Date()): Promise<void> {
    const monthlyPath = this.paths.monthlyPath(date);
    const weeklyPath = this.paths.weeklyPath(date);
    const dailyPath = this.dailyPath(date);
    const monthly = await this.files.read(monthlyPath);
    const weekly = this.paths.weeklyEnabled() ? await this.files.read(weeklyPath) : "";
    const daily = await this.files.read(dailyPath);
    const info = this.paths.dateInfo(date);
    const rootTasks = extractRootTasks(monthly).filter(isOpenTask);
    const migratedTasks = extractSectionTasks(monthly, migratedHeadingPredicate).filter(isOpenTask);
    const weeklyRootTasks = this.paths.weeklyEnabled() ? extractRootTasks(weekly).filter(isOpenTask) : [];
    const weeklyMigratedTasks = this.paths.weeklyEnabled() ? extractSectionTasks(weekly, migratedHeadingPredicate).filter(isOpenTask) : [];
    const daySource = this.paths.weeklyEnabled() ? weekly : monthly;
    const dayTasks = extractSectionTasks(daySource, dayHeadingPredicate(info.dd)).filter(
      (task) => (task.status === " " || task.status === "/" || task.status === ">") && isDueForDay(task.line, date),
    );
    const weeklyDayTasks = this.paths.weeklyEnabled() && !this.settings.monthlyEnabled
      ? extractSectionTasks(weekly, dayHeadingPredicate(info.dd)).filter(
          (task) => (task.status === " " || task.status === "/") && isDueForDay(task.line, date),
        )
      : [];
    const allTasks = [...rootTasks, ...migratedTasks, ...weeklyRootTasks, ...weeklyMigratedTasks, ...dayTasks, ...weeklyDayTasks];
    const ephemeral = allTasks.filter(isEphemeralTask);
    const forwardable = allTasks.filter((task) => !isEphemeralTask(task));
    const unique = uniqueNewPreparedTasks(
      extractTasksWithSubtasks(daily),
      forwardable.map((task) =>
        task.status === "/"
          ? prepareForwardableMigratedBlockPreservingStatus(task.block, task.status)
          : prepareForwardableMigratedBlock(task.block),
      ),
    );
    if (!unique.length && !ephemeral.length) return;
    if (unique.length) await this.files.write(dailyPath, insertAfterH1Compat(daily, unique));
    let updatedMonthly = monthly;
    let updatedWeekly = weekly;
    for (const task of [...rootTasks, ...migratedTasks].filter((task) => (task.status === " " || task.status === "/") && unique.some((line) => taskLooseKey(line) === taskLooseKey(task.line)))) {
      updatedMonthly = markMigratedTaskBlockInContent(updatedMonthly, task);
    }
    for (const task of [...rootTasks, ...migratedTasks].filter((task) => isEphemeralTask(task) && (task.status === " " || task.status === "/"))) {
      updatedMonthly = markEphemeralCancelledTaskBlockInContent(updatedMonthly, task);
    }
    for (const task of [...weeklyRootTasks, ...weeklyMigratedTasks, ...dayTasks].filter(
      (task) => (task.status === " " || task.status === "/") && unique.some((line) => taskLooseKey(line) === taskLooseKey(task.line)),
    )) {
      updatedWeekly = markMigratedTaskBlockInContent(updatedWeekly, task);
    }
    for (const task of [...weeklyRootTasks, ...weeklyMigratedTasks, ...dayTasks].filter((task) => isEphemeralTask(task) && (task.status === " " || task.status === "/"))) {
      updatedWeekly = markEphemeralCancelledTaskBlockInContent(updatedWeekly, task);
    }
    for (const task of weeklyDayTasks.filter(
      (task) => unique.some((line) => taskLooseKey(line) === taskLooseKey(task.line)),
    )) {
      updatedWeekly = markMigratedTaskBlockInContent(updatedWeekly, task);
    }
    if (this.settings.monthlyEnabled) await this.files.write(monthlyPath, updatedMonthly);
    if (this.paths.weeklyEnabled()) await this.files.write(weeklyPath, updatedWeekly);
  }

  async migratePreviousDays(date = new Date()): Promise<void> {
    const days = Math.max(0, Math.floor(this.settings.previousDayMigrationLookbackDays));
    for (let offset = 1; offset <= days; offset += 1) {
      await this.migratePreviousDay(date, offset);
    }
  }

  async migratePreviousDay(date = new Date(), offsetDays = 1): Promise<void> {
    const previous = addDays(date, -offsetDays);
    const previousPath = this.dailyPath(previous);
    const todayPath = this.dailyPath(date);
    const previousContent = await this.files.read(previousPath);
    if (!previousContent) return;
    const todayContent = await this.files.read(todayPath);
    const pending = previousDayCarryTasks(previousContent);
    const scheduledExpired = pending.filter((task) => !metadataDate(task.line, "📅") && /⏳\s*\d{4}-\d{2}-\d{2}/u.test(task.line));
    const toCarry = pending.filter((task) => !scheduledExpired.includes(task));
    const ephemeral = toCarry.filter(isEphemeralTask);
    const forwardable = toCarry.filter((task) => !isEphemeralTask(task));
    const unique = uniqueNewPreparedTasks(
      extractTasksWithSubtasks(todayContent),
      forwardable.map((task) => prepareForwardableMigratedBlock(task.block)),
    );
    let updatedPrevious = previousContent;
    if (unique.length) {
      await this.files.write(todayPath, insertAfterH1Compat(todayContent, unique));
      for (const task of forwardable.filter((task) => unique.some((line) => taskLooseKey(line) === taskLooseKey(task.line)))) {
        updatedPrevious = markMigratedTaskBlockInContent(updatedPrevious, task);
      }
    }
    for (const task of ephemeral) {
      updatedPrevious = markEphemeralCancelledTaskBlockInContent(updatedPrevious, task);
    }
    if (this.settings.cancelExpiredScheduled) {
      for (const task of scheduledExpired) {
        updatedPrevious = updatedPrevious.replace(task.line, markCancelled(task.line));
      }
    }
    updatedPrevious = markOpenChildrenOfMigratedBlocks(updatedPrevious);
    if (updatedPrevious !== previousContent) await this.files.write(previousPath, updatedPrevious);
  }

  async removeFutureScheduledFromDaily(date = new Date()): Promise<void> {
    const dailyPath = this.dailyPath(date);
    const daily = await this.files.read(dailyPath);
    if (!daily) return;
    let updated = daily;
    for (const task of extractTasksWithSubtasks(daily).filter(isOpenTask)) {
      if (!isOutOfDayScheduled(task.line, date)) continue;
      updated = updated.replace(task.block, "").replace(/\n{3,}/g, "\n\n");
    }
    if (updated !== daily) await this.files.write(dailyPath, updated.trimEnd() + "\n");
  }

  private async normalizeLogSpacing(date: Date): Promise<void> {
    const dailyPath = this.dailyPath(date);
    const daily = await this.files.read(dailyPath);
    if (daily) {
      const normalizedDaily = normalizeLogTextSpacing(removeMigratedChildrenFromOpenBlocks(daily));
      if (normalizedDaily !== daily) await this.files.write(dailyPath, normalizedDaily);
    }
    const monthlyPath = this.paths.monthlyPath(date);
    const monthly = await this.files.read(monthlyPath);
    if (monthly) {
      const normalizedMonthly = normalizeLogTextSpacing(monthly);
      if (normalizedMonthly !== monthly) await this.files.write(monthlyPath, normalizedMonthly);
    }
    if (this.paths.weeklyEnabled()) {
      const weeklyPath = this.paths.weeklyPath(date);
      const weekly = await this.files.read(weeklyPath);
      if (weekly) {
        const normalizedWeekly = normalizeLogTextSpacing(weekly);
        if (normalizedWeekly !== weekly) await this.files.write(weeklyPath, normalizedWeekly);
      }
    }
  }

  private async markAnnualRecurringMigrated(date: Date): Promise<void> {
    const annualPath = this.paths.annualPath(date);
    const annual = await this.files.read(annualPath);
    if (!annual) return;
    const pred = monthPredicate(this.paths.dateInfo(date).monthName);
    const tasks = extractSectionTasks(annual, pred).filter((task) => isOpenTask(task) && /\bevery\b/i.test(task.line));
    let updated = annual;
    for (const task of tasks) {
      if (!this.recurrence.datesInMonthForTask(task.line, date).length) continue;
      updated = updated.replace(task.line, markMigrated(task.line));
    }
    if (updated !== annual) await this.files.write(annualPath, updated);
  }

  private dailyPath(date: Date): string {
    return this.files.findMarkdownByBasenamePrefix(this.paths.dailyPrefix(date))?.path ?? this.paths.dailyPath(date);
  }

  private async insertRecurringOccurrence(task: TaskBlock, counts: Map<string, number>, occurrence: Date): Promise<void> {
    const targetPath = this.paths.weeklyEnabled() ? this.paths.weeklyPath(occurrence) : this.paths.monthlyPath(occurrence);
    const target = await this.files.read(targetPath);
    const pred = dayHeadingPredicate(this.paths.dateInfo(occurrence).dd);
    const prepared = prepareRecurringTask(task, occurrence);
    if (hasUniqueLooseKey(task.line, counts)) {
      // Replacement preserves the current task status when the operational copy already exists.
    }
    const unique = uniqueNewPreparedTasks(extractSectionTasks(target, pred), [prepared]);
    if (unique.length) await this.files.write(targetPath, insertIntoSection(target, pred, unique));
  }
}

function looseKeyCounts(tasks: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    const key = taskLooseKey(task);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function hasUniqueLooseKey(task: string, counts: Map<string, number>): boolean {
  return (counts.get(taskLooseKey(task)) ?? 0) === 1;
}

function insertAfterH1Compat(content: string, linesToInsert: string[]): string {
  if (!linesToInsert.length) return content;
  const lines = content.split(/\r?\n/);
  const separated = separateTaskBlocks(linesToInsert);
  const index = lines.findIndex((line) => /^#\s+/.test(line));
  if (index === -1) return `${separated.join("\n")}\n\n${content}`;
  let at = index + 1;
  while (at < lines.length && lines[at].trim() === "") at += 1;
  lines.splice(at, 0, ...separated, "");
  return lines.join("\n");
}

function separateTaskBlocks(lines: string[]): string[] {
  return lines.flatMap((line, index) => (index === 0 ? [line] : ["", line]));
}

function isDueForDay(line: string, date: Date): boolean {
  const scheduled = scheduledDate(line);
  const start = startDate(line);
  if (scheduled && !sameDay(scheduled, date)) return false;
  if (start && start > startOfDay(date)) return false;
  return true;
}

function isOutOfDayScheduled(line: string, date: Date): boolean {
  const scheduled = scheduledDate(line);
  const start = startDate(line);
  const today = startOfDay(date);
  return Boolean((scheduled && !sameDay(scheduled, today)) || (start && start > today));
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function previousDayCarryTasks(content: string): TaskBlock[] {
  const lines = String(content || "").split(/\r?\n/);
  const parsed = lines.flatMap((line, index) => {
    const match = line.match(/^(\s*)-\s+\[([^\]])\]\s+(.*)$/);
    if (!match) return [];
    return [{ index, line, indent: match[1].length, status: match[2], text: match[3] }];
  });
  const byIndex = new Map(parsed.map((task) => [task.index, task]));
  const covered = new Set<number>();
  const tasks: TaskBlock[] = [];

  for (const task of parsed) {
    if (!isCarryableStatus(task.status) || covered.has(task.index)) continue;
    const block = task.indent === 0 ? taskBlock(lines, task.index) : unindentedTaskBlock(lines, task.index);
    tasks.push({ line: task.line, block, indent: task.line.match(/^\s*/)?.[0] ?? "", status: task.status, text: task.text });

    if (task.indent === 0) {
      for (const index of descendantTaskIndexes(lines, task.index)) {
        const descendant = byIndex.get(index);
        if (descendant && isCarryableStatus(descendant.status)) covered.add(index);
      }
    }
  }

  return tasks;
}

function taskBlock(lines: string[], start: number): string {
  const block = [lines[start]];
  const parentIndent = indentation(lines[start]);
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,6}\s+/.test(lines[index])) break;
    if (isTaskLine(lines[index]) && indentation(lines[index]) <= parentIndent) break;
    if (/^\s+/.test(lines[index]) && !/^\s*-\s+\[(x|-|>)\]/i.test(lines[index])) block.push(lines[index]);
  }
  return block.join("\n");
}

function unindentedTaskBlock(lines: string[], start: number): string {
  const baseIndent = indentation(lines[start]);
  return taskBlock(lines, start)
    .split(/\r?\n/)
    .map((line) => (line.slice(0, baseIndent).trim() ? line : line.slice(baseIndent)))
    .join("\n");
}

function descendantTaskIndexes(lines: string[], start: number): number[] {
  const indexes: number[] = [];
  const parentIndent = indentation(lines[start]);
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^#{1,6}\s+/.test(lines[index])) break;
    if (isTaskLine(lines[index]) && indentation(lines[index]) <= parentIndent) break;
    if (isTaskLine(lines[index])) indexes.push(index);
  }
  return indexes;
}

function isCarryableStatus(status: string): boolean {
  return status === " " || status === "/";
}

function isTaskLine(line: string): boolean {
  return /^(\s*)-\s+\[[^\]]\]\s+/.test(line);
}

function indentation(line: string): number {
  return line.match(/^\s*/)?.[0].length ?? 0;
}
