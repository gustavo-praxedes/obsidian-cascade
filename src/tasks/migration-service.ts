import type { CascadeSettings } from "../config/schema";
import type { LogService } from "../logging/log-service";
import { addDays, normalizeText } from "../notes/path-service";
import { FileService } from "../vault/file-service";
import { LockService } from "../vault/lock-service";
import { PathService } from "../notes/path-service";
import {
  dayHeadingPredicate,
  dueDate,
  extractRecurringTasks,
  extractSectionTasks,
  extractTasksWithSubtasks,
  isEphemeralTask,
  isOpenTask,
  metadataDate,
  monthPredicate,
  scheduledDate,
  startDate,
  taskLooseKey,
  type TaskBlock,
} from "./task-parser";
import { RecurrenceService } from "./recurrence-service";

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
import {
  insertIntoSection,
  markCancelled,
  markEphemeralCancelledTaskBlockInContent,
  markMigrated,
  markMigratedInSection,
  markMigratedTaskBlockInContent,
  markOpenChildrenOfMigratedBlocks,
  normalizeLogSpacing as normalizeLogTextSpacing,
  prepareForwardableMigratedBlock,
  prepareForwardableMigratedBlockPreservingStatus,
  removeMigratedChildrenFromOpenBlocks,
  prepareRecurringTask,
  stripRecurrence,
  uniqueNewPreparedTasks,
  withCreatedDate,
  withDoneDate,
  withGlobalFilter,
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

  private prepareForwardedBlock(task: TaskBlock): string {
    const prepared = task.status === "/"
      ? prepareForwardableMigratedBlockPreservingStatus(task.block, task.status)
      : stripRecurrence(prepareForwardableMigratedBlock(task.block));
    const withDate = this.settings.taskSetCreatedDate ? withCreatedDate(prepared, new Date()) : prepared;
    return withGlobalFilter(withDate, this.settings.taskGlobalFilter?.trim() ?? "");
  }

  private prepareCarriedBlock(task: TaskBlock): string {
    const prepared = task.status === "/"
      ? prepareForwardableMigratedBlockPreservingStatus(task.block, task.status)
      : prepareForwardableMigratedBlock(task.block);
    const withDate = this.settings.taskSetCreatedDate ? withCreatedDate(prepared, new Date()) : prepared;
    return withGlobalFilter(withDate, this.settings.taskGlobalFilter?.trim() ?? "");
  }

  private markTaskMigrated(content: string, task: TaskBlock): string {
    let updated = markMigratedTaskBlockInContent(content, task);
    if (this.settings.taskSetDoneDate) {
      updated = updated.replace(task.line, withDoneDate(markMigrated(task.line), new Date()));
    }
    return updated;
  }

  private matchesGlobalFilter(_task: TaskBlock): boolean {
    return true;
  }

  private prepareRecurring(task: TaskBlock, occurrence: Date): string {
    const prepared = this.settings.taskSetCreatedDate
      ? withCreatedDate(prepareRecurringTask(task, occurrence), occurrence)
      : prepareRecurringTask(task, occurrence);
    return withGlobalFilter(prepared, this.settings.taskGlobalFilter?.trim() ?? "");
  }

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
        } else if (this.paths.weeklyEnabled()) {
          await this.migrateAnnualToWeekly(date);
        }
      } else if (this.settings.monthlyEnabled) {
        await this.seedRecurringToMonthly(date);
      } else if (this.paths.weeklyEnabled()) {
        await this.seedRecurringToWeekly(date);
      } else {
        await this.seedRecurringToDaily(date);
      }
      if (this.paths.weeklyEnabled() && this.settings.monthlyEnabled) {
        await this.migrateMonthlyToWeekly(date);
      }
      if (this.settings.monthlyEnabled || this.paths.weeklyEnabled()) {
        await this.migrateMonthlyToDaily(date);
        await this.migratePreviousDays(date);
        await this.removeFutureScheduledFromDaily(date);
      }
      await this.normalizeLogSpacing(date);
      this.log.migration.info("Migration complete");
    });
  }

  private async processLostPeriods(date: Date): Promise<void> {
    const lookback = Math.max(0, Math.floor(this.settings.previousDayMigrationLookbackDays));

    // Find the last processed date for each period type by scanning existing files
    const lastAnnual = this.files.lastProcessedDate(
      /^\d{12}-\d{4}\.md$/i,
      (b) => { const y = parseInt(b.slice(0, 4), 10); return y > 0 ? new Date(y, 0, 1) : null; },
    );
    const lastMonthly = this.files.lastProcessedDate(
      /^\d{12}-[\p{L}0-9-]+\.md$/iu,
      (b) => { const y = parseInt(b.slice(0, 4), 10); const m = parseInt(b.slice(4, 6), 10); return y > 0 && m >= 1 && m <= 12 ? new Date(y, m - 1, 1) : null; },
    );
    const lastWeekly = this.files.lastProcessedDate(
      /^\d{12}-S-\d{2}\.md$/i,
      (b) => { const s = b.slice(0, 8); const y = parseInt(s.slice(0, 4), 10); const m = parseInt(s.slice(4, 6), 10) - 1; const d = parseInt(s.slice(6, 8), 10); return new Date(y, m, d); },
    );
    const lastDaily = this.files.lastProcessedDate(
      /^\d{12}-.+\.md$/i,
      (b) => { const s = b.slice(0, 8); const y = parseInt(s.slice(0, 4), 10); const m = parseInt(s.slice(4, 6), 10) - 1; const d = parseInt(s.slice(6, 8), 10); return new Date(y, m, d); },
    );

    // Compute scan period: from the most recent existing file, or fallback to lookback
    const earliestExisting = [lastAnnual, lastMonthly, lastWeekly, lastDaily].filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0] ?? null;
    const scanStart = earliestExisting
      ? earliestExisting
      : addDays(date, -(lookback || 1));

    // Process ALL missing years from last processed to current year
    if (this.settings.yearlyEnabled) {
      const startYear = lastAnnual ? lastAnnual.getFullYear() + 1 : scanStart.getFullYear();
      for (let year = startYear; year <= date.getFullYear(); year++) {
        await this.files.ensureFile(this.paths.annualPath(new Date(year, 0, 1)), this.paths.renderAnnualLog(new Date(year, 0, 1)));
      }
    }

    // Process ALL missing months (before current month only)
    // NOTE: Do NOT call migrateAnnualToMonthly here - it will be called in the main run()
    if (this.settings.monthlyEnabled) {
      const startMonth = lastMonthly
        ? new Date(lastMonthly.getFullYear(), lastMonthly.getMonth() + 1, 1)
        : new Date(scanStart.getFullYear(), scanStart.getMonth(), 1);
      const endMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      let cursor = startMonth;
      while (cursor < endMonth) {
        await this.ensureMonthly(cursor);
        // Do NOT migrate here - just ensure the file exists
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    }

    // Process ALL missing weeks (before current week only)
    if (this.paths.weeklyEnabled()) {
      const startWeek = lastWeekly
        ? addDays(lastWeekly, 7)
        : scanStart;
      let cursor = startWeek;
      while (cursor < date) {
        await this.files.findOrCreateFile(
          this.paths.weeklyPath(cursor),
          this.paths.renderWeeklyLog(cursor),
          (f) => this.paths.isWeeklyFile(f.basename, cursor),
        );
        cursor = addDays(cursor, 7);
      }
    }

    // Process ALL missing days (before today only)
    // NOTE: Do NOT call migrateMonthlyToDaily here - it will be called in the main run()
    const startDay = lastDaily ? addDays(lastDaily, 1) : scanStart;
    let cursor = startDay;
    while (cursor < date) {
      await this.files.findOrCreateFile(
        this.paths.dailyPath(cursor),
        this.paths.renderDailyLog(cursor),
        (f) => this.paths.isDailyFile(f.basename, cursor),
      );
      cursor = addDays(cursor, 1);
    }
  }

  private async ensureCascadeFiles(date: Date): Promise<void> {
    if (this.settings.yearlyEnabled) await this.files.ensureFile(this.paths.annualPath(date), this.paths.renderAnnualLog(date));
    if (this.settings.monthlyEnabled) {
      await this.files.findOrCreateFile(
        this.paths.monthlyPath(date),
        this.paths.renderMonthlyLog(date),
        (f) => this.paths.isMonthlyFile(f.basename, date),
      );
    }
    if (this.paths.weeklyEnabled()) {
      await this.files.findOrCreateFile(
        this.paths.weeklyPath(date),
        this.paths.renderWeeklyLog(date),
        (f) => this.paths.isWeeklyFile(f.basename, date),
      );
    }
    await this.files.findOrCreateFile(
      this.paths.dailyPath(date),
      this.paths.renderDailyLog(date),
      (f) => this.paths.isDailyFile(f.basename, date),
    );
  }

  private async ensureMonthly(date: Date): Promise<void> {
    await this.files.findOrCreateFile(
      this.paths.monthlyPath(date),
      this.paths.renderMonthlyLog(date),
      (f) => this.paths.isMonthlyFile(f.basename, date),
    );
  }

  async seedAnnualFromRecurring(date = new Date()): Promise<void> {
    if (!this.settings.recurringTasksPath) return;
    const recurring = await this.files.read(this.settings.recurringTasksPath);
    const tasks = extractRecurringTasks(recurring).filter((task) => this.matchesGlobalFilter(task));
    const counts = looseKeyCounts(tasks.map((task) => task.line));
    const annualPath = this.paths.annualPath(date);
    let annual = await this.files.read(annualPath);
    for (const task of tasks) {
      for (let index = 0; index < 12; index += 1) {
        const monthDate = new Date(this.paths.operationalYear(date), index, 1);
        const dates = this.recurrence.datesInMonthForTask(task.line, monthDate);
        if (!dates.length) continue;
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
    const pending = extractSectionTasks(annual, pred).filter((task) => isOpenTask(task));
    if (!pending.length) return;

    // All tasks (including ephemeral) should be instantiated in downstream files
    const forwardable = pending;

    // Separate recurring tasks (with 🔁) from regular forwardable tasks
    const recurring = forwardable.filter((task) => /🔁\s*every/i.test(task.text));
    const regularForwardable = forwardable.filter((task) => !/🔁\s*every/i.test(task.text));

    // Process recurring tasks: create instances for each occurrence in current month
    for (const task of recurring) {
      for (const occurrence of this.recurrence.datesInMonthForTask(task.line, date)) {
        const prepared = this.prepareRecurring(task, occurrence);

        if (this.paths.weeklyEnabled()) {
          // Insert into monthly file under the appropriate week link
          const weekInfo = this.paths.dateInfo(occurrence);
          const weekPred = (line: string) => {
            const normalizedLine = normalizeText(line).toUpperCase();
            return normalizedLine.includes(`S-${pad2(weekInfo.week)}`);
          };
          const unique = uniqueNewPreparedTasks(extractSectionTasks(monthly, weekPred), [prepared]);
          if (unique.length) monthly = insertIntoSection(monthly, weekPred, unique);
        } else {
          // Insert into monthly file under the appropriate day heading
          const dayPred = dayHeadingPredicate(this.paths.dateInfo(occurrence).dd);
          const unique = uniqueNewPreparedTasks(extractSectionTasks(monthly, dayPred), [prepared]);
          if (unique.length) monthly = insertIntoSection(monthly, dayPred, unique);
        }
      }
    }

    // Process regular forwardable tasks
    const unique = uniqueNewPreparedTasks(
      extractTasksWithSubtasks(monthly),
      regularForwardable.map((task) => this.prepareForwardedBlock(task)),
    );
    monthly = insertAfterH1Compat(monthly, unique);

    let updatedAnnual = annual;
    // Mark only tasks within the current month section as migrated
    updatedAnnual = markMigratedInSection(updatedAnnual, pred, forwardable);
    await this.files.write(monthlyPath, monthly);
    await this.files.write(annualPath, updatedAnnual);
  }

  async migrateAnnualToWeekly(date = new Date()): Promise<void> {
    const annualPath = this.paths.annualPath(date);
    const annual = await this.files.read(annualPath);
    const info = this.paths.dateInfo(date);
    const pred = monthPredicate(info.monthName);
    const pending = extractSectionTasks(annual, pred).filter((task) => isOpenTask(task));
    if (!pending.length) return;

    // All tasks (including ephemeral) should be instantiated in downstream files
    const forwardable = pending;
    
    // Separate recurring tasks (with 🔁) from regular forwardable tasks
    const recurring = forwardable.filter((task) => /🔁\s*every/i.test(task.text));
    const regularForwardable = forwardable.filter((task) => !/🔁\s*every/i.test(task.text));
    
    // Process recurring tasks: create instances for each occurrence in current month
    for (const task of recurring) {
      for (const occurrence of this.recurrence.datesInMonthForTask(task.line, date)) {
        const { actualPath: weeklyPath } = await this.files.findOrCreateFile(
          this.paths.weeklyPath(occurrence),
          this.paths.renderWeeklyLog(occurrence),
          (f) => this.paths.isWeeklyFile(f.basename, occurrence),
        );
        const weekly = await this.files.read(weeklyPath);
        const prepared = this.prepareRecurring(task, occurrence);
        const dayPred = dayHeadingPredicate(this.paths.dateInfo(occurrence).dd);
        const unique = uniqueNewPreparedTasks(extractSectionTasks(weekly, dayPred), [prepared]);
        if (unique.length) await this.files.write(weeklyPath, insertIntoSection(weekly, dayPred, unique));
      }
    }
    
    // Process regular forwardable tasks
    for (const task of regularForwardable) {
      const { actualPath: weeklyPath } = await this.files.findOrCreateFile(
        this.paths.weeklyPath(date),
        this.paths.renderWeeklyLog(date),
        (f) => this.paths.isWeeklyFile(f.basename, date),
      );
      const weekly = await this.files.read(weeklyPath);
      const prepared = this.prepareForwardedBlock(task);
      const dayPred = dayHeadingPredicate(info.dd);
      const unique = uniqueNewPreparedTasks(extractSectionTasks(weekly, dayPred), [prepared]);
      if (unique.length) await this.files.write(weeklyPath, insertIntoSection(weekly, dayPred, unique));
    }
    
    let updatedAnnual = annual;
    // Mark only tasks within the current month section as migrated
    updatedAnnual = markMigratedInSection(updatedAnnual, pred, forwardable);
    await this.files.write(annualPath, updatedAnnual);
  }

  async seedRecurringToMonthly(date = new Date()): Promise<void> {
    if (!this.settings.recurringTasksPath) return;
    const source = await this.files.read(this.settings.recurringTasksPath);
    const tasks = extractRecurringTasks(source).filter((task) => this.matchesGlobalFilter(task));
    if (!tasks.length) return;
    const counts = looseKeyCounts(tasks.map((task) => task.line));
    const { actualPath: targetPath } = await this.files.findOrCreateFile(
      this.paths.monthlyPath(date),
      this.paths.renderMonthlyLog(date),
      (f) => this.paths.isMonthlyFile(f.basename, date),
    );
    let updated = await this.files.read(targetPath);
    for (const task of tasks) {
      for (const occurrence of this.recurrence.datesInMonthForTask(task.line, date)) {
        const pred = dayHeadingPredicate(this.paths.dateInfo(occurrence).dd);
        const prepared = this.prepareRecurring(task, occurrence);
        if (hasUniqueLooseKey(task.line, counts)) {
          // Replacement preserves the current task status when the operational copy already exists.
        }
        const unique = uniqueNewPreparedTasks(extractSectionTasks(updated, pred), [prepared]);
        updated = insertIntoSection(updated, pred, unique);
      }
    }
    await this.files.write(targetPath, updated);
  }

  async seedRecurringToWeekly(date = new Date()): Promise<void> {
    if (!this.settings.recurringTasksPath) return;
    const source = await this.files.read(this.settings.recurringTasksPath);
    const tasks = extractRecurringTasks(source).filter((task) => this.matchesGlobalFilter(task));
    if (!tasks.length) return;
    const counts = looseKeyCounts(tasks.map((task) => task.line));
    for (const task of tasks) {
      for (const occurrence of this.recurrence.datesInMonthForTask(task.line, date)) {
        const { actualPath: targetPath } = await this.files.findOrCreateFile(
          this.paths.weeklyPath(occurrence),
          this.paths.renderWeeklyLog(occurrence),
          (f) => this.paths.isWeeklyFile(f.basename, occurrence),
        );
        const target = await this.files.read(targetPath);
        const pred = dayHeadingPredicate(this.paths.dateInfo(occurrence).dd);
        const prepared = this.prepareRecurring(task, occurrence);
        if (hasUniqueLooseKey(task.line, counts)) {
          // Replacement preserves the current task status when the operational copy already exists.
        }
        const unique = uniqueNewPreparedTasks(extractSectionTasks(target, pred), [prepared]);
        if (unique.length) await this.files.write(targetPath, insertIntoSection(target, pred, unique));
      }
    }
  }

  async seedRecurringToDaily(date = new Date()): Promise<void> {
    if (!this.settings.recurringTasksPath) return;
    const source = await this.files.read(this.settings.recurringTasksPath);
    const tasks = extractRecurringTasks(source).filter((task) => this.matchesGlobalFilter(task));
    if (!tasks.length) return;
    const dailyPath = this.dailyPath(date);
    let daily = await this.files.read(dailyPath);
    for (const task of tasks) {
      for (const occurrence of this.recurrence.datesInMonthForTask(task.line, date)) {
        const prepared = this.prepareRecurring(task, occurrence);
        const unique = uniqueNewPreparedTasks(extractTasksWithSubtasks(daily), [prepared]);
        if (unique.length) daily = insertAfterH1Compat(daily, unique);
      }
    }
    await this.files.write(dailyPath, daily);
  }

  async migrateMonthlyToWeekly(date = new Date()): Promise<void> {
    if (!this.paths.weeklyEnabled()) return;
    
    const monthlyPath = this.monthlyPath(date);
    let monthly = await this.files.read(monthlyPath);
    const info = this.paths.dateInfo(date);
    
    // Get tasks from the monthly file's week sections
    const weekPred = (line: string) => {
      const normalizedLine = normalizeText(line).toUpperCase();
      return normalizedLine.includes(`S-${pad2(info.week)}`);
    };
    const weekTasks = extractSectionTasks(monthly, weekPred).filter(isOpenTask);
    if (!weekTasks.length) return;
    
    // Insert tasks into the weekly file's day sections
    const { actualPath: weeklyPath } = await this.files.findOrCreateFile(
      this.paths.weeklyPath(date),
      this.paths.renderWeeklyLog(date),
      (f) => this.paths.isWeeklyFile(f.basename, date),
    );
    let weekly = await this.files.read(weeklyPath);
    
    const inserted: TaskBlock[] = [];
    for (const task of weekTasks) {
      // Determine which day this task belongs to based on its 📅 date
      const taskDateMatch = task.text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
      if (!taskDateMatch) continue;
      const taskDate = new Date(taskDateMatch[1] + 'T12:00:00');
      const taskInfo = this.paths.dateInfo(taskDate);
      
      const prepared = this.prepareRecurring(task, taskDate);
      const dayPred = dayHeadingPredicate(taskInfo.dd);
      const unique = uniqueNewPreparedTasks(extractSectionTasks(weekly, dayPred), [prepared]);
      if (unique.length) {
        weekly = insertIntoSection(weekly, dayPred, unique);
        inserted.push(task);
      }
    }
    
    // Mark only the tasks that were actually inserted as migrated in monthly
    if (inserted.length) {
      monthly = markMigratedInSection(monthly, weekPred, inserted);
      await this.files.write(monthlyPath, monthly);
    }
    await this.files.write(weeklyPath, weekly);
  }

  async migrateMonthlyToDaily(date = new Date()): Promise<void> {
    const monthlyPath = this.monthlyPath(date);
    const weeklyPath = this.weeklyPath(date);
    const dailyPath = this.dailyPath(date);
    let monthly = await this.files.read(monthlyPath);
    const weekly = this.paths.weeklyEnabled() ? await this.files.read(weeklyPath) : "";
    const daily = await this.files.read(dailyPath);
    const info = this.paths.dateInfo(date);
    
    // When weekly is enabled, read ONLY from weekly file's day section
    // When weekly is disabled, read from monthly file's day sections
    let dayTasks: TaskBlock[] = [];
    let sourceFile: "weekly" | "monthly" = "monthly";
    if (this.paths.weeklyEnabled()) {
      sourceFile = "weekly";
      dayTasks = extractSectionTasks(weekly, dayHeadingPredicate(info.dd)).filter(
        (task) => (task.status === " " || task.status === "/" || task.status === ">") && isDueForDay(task.line, date),
      );
    } else {
      dayTasks = extractSectionTasks(monthly, dayHeadingPredicate(info.dd)).filter(
        (task) => (task.status === " " || task.status === "/" || task.status === ">") && isDueForDay(task.line, date),
      );
    }
    
    if (!dayTasks.length) return;
    
    const unique = uniqueNewPreparedTasks(
      extractTasksWithSubtasks(daily),
      dayTasks.map((task) => this.prepareForwardedBlock(task)),
    );
    if (!unique.length) return;
    await this.files.write(dailyPath, insertAfterH1Compat(daily, unique));
    
    // Mark tasks as migrated in the source file using section-scoped marking
    const dayPred = dayHeadingPredicate(info.dd);
    const tasksToMark = dayTasks.filter(
      (task) => (task.status === " " || task.status === "/") && unique.some((line) => taskLooseKey(line) === taskLooseKey(task.line)),
    );
    
    if (sourceFile === "weekly") {
      let updatedWeekly = weekly;
      updatedWeekly = markMigratedInSection(updatedWeekly, dayPred, tasksToMark);
      // Cancel ephemeral tasks that are still open
      for (const task of dayTasks.filter(
        (task) => isEphemeralTask(task) && (task.status === " " || task.status === "/"),
      )) {
        updatedWeekly = markEphemeralCancelledTaskBlockInContent(updatedWeekly, task);
      }
      await this.files.write(weeklyPath, updatedWeekly);
    } else {
      let updatedMonthly = monthly;
      updatedMonthly = markMigratedInSection(updatedMonthly, dayPred, tasksToMark);
      // Cancel ephemeral tasks that are still open
      for (const task of dayTasks.filter(
        (task) => isEphemeralTask(task) && (task.status === " " || task.status === "/"),
      )) {
        updatedMonthly = markEphemeralCancelledTaskBlockInContent(updatedMonthly, task);
      }
      await this.files.write(monthlyPath, updatedMonthly);
    }
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
      forwardable.map((task) => this.prepareCarriedBlock(task)),
    );
    let updatedPrevious = previousContent;
    if (unique.length) {
      await this.files.write(todayPath, insertAfterH1Compat(todayContent, unique));
      for (const task of forwardable.filter((task) => unique.some((line) => taskLooseKey(line) === taskLooseKey(task.line)))) {
        updatedPrevious = this.markTaskMigrated(updatedPrevious, task);
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
    const monthlyPath = this.monthlyPath(date);
    const monthly = await this.files.read(monthlyPath);
    if (monthly) {
      const normalizedMonthly = normalizeLogTextSpacing(monthly);
      if (normalizedMonthly !== monthly) await this.files.write(monthlyPath, normalizedMonthly);
    }
    if (this.paths.weeklyEnabled()) {
      const weeklyPath = this.weeklyPath(date);
      const weekly = await this.files.read(weeklyPath);
      if (weekly) {
        const normalizedWeekly = normalizeLogTextSpacing(weekly);
        if (normalizedWeekly !== weekly) await this.files.write(weeklyPath, normalizedWeekly);
      }
    }
  }

  private dailyPath(date: Date): string {
    const path = this.paths.dailyPath(date);
    const existing = this.files.getFile(path) ?? this.files.findMarkdownByPredicate((f) => this.paths.isDailyFile(f.basename, date));
    return existing?.path ?? path;
  }

  private weeklyPath(date: Date): string {
    const path = this.paths.weeklyPath(date);
    const existing = this.files.getFile(path) ?? this.files.findMarkdownByPredicate((f) => this.paths.isWeeklyFile(f.basename, date));
    return existing?.path ?? path;
  }

  private monthlyPath(date: Date): string {
    const path = this.paths.monthlyPath(date);
    const existing = this.files.getFile(path) ?? this.files.findMarkdownByPredicate((f) => this.paths.isMonthlyFile(f.basename, date));
    return existing?.path ?? path;
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
  const due = dueDate(line);
  const scheduled = scheduledDate(line);
  const start = startDate(line);
  if (due && !sameDay(due, date)) return false;
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
