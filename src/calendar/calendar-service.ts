import type { CascadeSettings } from "../config/schema";
import { PathService } from "../notes/path-service";
import { FileService } from "../vault/file-service";
import type { Vault } from "obsidian";

export class CalendarService {
  private hasDailyCache = new Map<string, boolean>();
  private cacheMonthKey = "";

  constructor(
    private readonly settings: CascadeSettings,
    private readonly paths: PathService,
    private readonly files: FileService,
    private readonly vault: Vault,
  ) {}

  monthGrid(monthDate: Date): Date[] {
    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const offset = (first.getDay() - this.settings.calendarFirstDayOfWeek + 7) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }

  getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  hasDaily(date: Date): boolean {
    const mk = `${date.getFullYear()}-${date.getMonth()}`;
    if (mk !== this.cacheMonthKey) {
      this.hasDailyCache.clear();
      this.cacheMonthKey = mk;
    }
    const key = date.toISOString().slice(0, 10);
    if (this.hasDailyCache.has(key)) return this.hasDailyCache.get(key)!;

    const result =
      this.files.exists(this.paths.dailyPath(date)) ||
      this.vault.getMarkdownFiles().some((f) => this.paths.isDailyFile(f.basename, date));
    this.hasDailyCache.set(key, result);
    return result;
  }
}
