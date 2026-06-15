import type { CascadeSettings } from "../config/schema";
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
  metadataDate,
  migratedHeadingPredicate,
  monthPredicate,
  taskLooseKey,
} from "./task-parser";
import { RecurrenceService } from "./recurrence-service";
import {
  insertIntoSection,
  markCancelled,
  markMigrated,
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
  ) {}

  async run(date = new Date()): Promise<void> {
    if (!this.settings.migrationEnabled) return;
    await this.lock.runExclusive(async () => {
      await this.ensureCascadeFiles(date);
      await this.seedAnnualFromRecurring(date);
      await this.ensureMonthly(date);
      await this.migrateAnnualToMonthly(date);
      await this.seedMonthlyRecurring(date);
      await this.migrateMonthlyToDaily(date);
      await this.migratePreviousDay(date);
    });
  }

  private async ensureCascadeFiles(date: Date): Promise<void> {
    await this.files.ensureFile(this.paths.annualPath(date), this.paths.renderAnnualLog(date));
    await this.files.ensureFile(this.paths.monthlyPath(date), this.paths.renderMonthlyLog(date));
    await this.files.ensureFile(this.paths.dailyPath(date), this.paths.renderDailyLog(date));
  }

  private async ensureMonthly(date: Date): Promise<void> {
    await this.files.ensureFile(this.paths.monthlyPath(date), this.paths.renderMonthlyLog(date));
  }

  async seedAnnualFromRecurring(date = new Date()): Promise<void> {
    if (!this.settings.recurringTasksPath) return;
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
    const pending = extractSectionTasks(annual, pred).filter((task) => !/\bevery\b/i.test(task.line));
    if (!pending.length) return;
    const unique = uniqueNewPreparedTasks(extractTasksWithSubtasks(monthly), pending.map((task) => task.line));
    monthly = insertAfterH1Compat(monthly, unique);
    let updatedAnnual = annual;
    for (const task of pending) updatedAnnual = updatedAnnual.replace(task.line, markMigrated(task.line));
    await this.files.write(monthlyPath, monthly);
    await this.files.write(annualPath, updatedAnnual);
  }

  async seedMonthlyRecurring(date = new Date()): Promise<void> {
    if (!this.settings.recurringTasksPath) return;
    const source = await this.files.read(this.settings.recurringTasksPath);
    const tasks = extractRecurringTasks(source);
    if (!tasks.length) return;
    const counts = looseKeyCounts(tasks.map((task) => task.line));
    const monthlyPath = this.paths.monthlyPath(date);
    const monthly = await this.files.read(monthlyPath);
    let updated = monthly;
    for (const task of tasks) {
      for (const occurrence of this.recurrence.datesInMonthForTask(task.line, date)) {
        const pred = dayHeadingPredicate(this.paths.dateInfo(occurrence).dd);
        const prepared = prepareRecurringTask(task, occurrence);
        if (hasUniqueLooseKey(task.line, counts)) {
          // Replacement preserves the current task status when the operational copy already exists.
        }
        const unique = uniqueNewPreparedTasks(extractSectionTasks(updated, pred), [prepared]);
        updated = insertIntoSection(updated, pred, unique);
      }
    }
    await this.files.write(monthlyPath, updated);
  }

  async migrateMonthlyToDaily(date = new Date()): Promise<void> {
    const monthlyPath = this.paths.monthlyPath(date);
    const dailyPath = this.paths.dailyPath(date);
    const monthly = await this.files.read(monthlyPath);
    const daily = await this.files.read(dailyPath);
    const info = this.paths.dateInfo(date);
    const rootTasks = extractRootTasks(monthly);
    const migratedTasks = extractSectionTasks(monthly, migratedHeadingPredicate);
    const dayTasks = extractSectionTasks(monthly, dayHeadingPredicate(info.dd));
    const tasks = [...rootTasks, ...migratedTasks, ...dayTasks];
    const unique = uniqueNewPreparedTasks(extractTasksWithSubtasks(daily), tasks.map((task) => task.line));
    if (!unique.length) return;
    await this.files.write(dailyPath, insertAfterH1Compat(daily, unique));
    let updatedMonthly = monthly;
    for (const task of tasks.filter((task) => unique.some((line) => line === task.line))) {
      updatedMonthly = updatedMonthly.replace(task.line, markMigrated(task.line));
    }
    await this.files.write(monthlyPath, updatedMonthly);
  }

  async migratePreviousDay(date = new Date()): Promise<void> {
    const previous = addDays(date, -1);
    const previousPath = this.paths.dailyPath(previous);
    const todayPath = this.paths.dailyPath(date);
    const previousContent = await this.files.read(previousPath);
    if (!previousContent) return;
    const todayContent = await this.files.read(todayPath);
    const pending = extractTasksWithSubtasks(previousContent);
    const scheduledExpired = pending.filter((task) => !metadataDate(task.line, "📅") && /⏳\s*\d{4}-\d{2}-\d{2}/u.test(task.line));
    const toCarry = pending.filter((task) => !scheduledExpired.includes(task));
    const unique = uniqueNewPreparedTasks(extractTasksWithSubtasks(todayContent), toCarry.map((task) => task.line));
    if (unique.length) await this.files.write(todayPath, insertAfterH1Compat(todayContent, unique));
    if (!this.settings.cancelExpiredScheduled) return;
    let updatedPrevious = previousContent;
    for (const task of scheduledExpired) {
      updatedPrevious = updatedPrevious.replace(task.line, markCancelled(task.line));
    }
    if (updatedPrevious !== previousContent) await this.files.write(previousPath, updatedPrevious);
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
  const index = lines.findIndex((line) => /^#\s+/.test(line));
  if (index === -1) return `${linesToInsert.join("\n")}\n\n${content}`;
  let at = index + 1;
  while (at < lines.length && lines[at].trim() === "") at += 1;
  lines.splice(at, 0, ...linesToInsert, "");
  return lines.join("\n");
}
