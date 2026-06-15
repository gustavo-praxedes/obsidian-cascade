import type { CascadeSettings } from "../config/schema";
import { PathService } from "../notes/path-service";
import { FileService } from "../vault/file-service";

export class CalendarService {
  constructor(
    private readonly settings: CascadeSettings,
    private readonly paths: PathService,
    private readonly files: FileService,
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

  hasDaily(date: Date): boolean {
    return this.files.exists(this.paths.dailyPath(date));
  }
}
