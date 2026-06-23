import type { CascadeSettings } from "../config/schema";
import { PathService } from "../notes/path-service";
import { FileService } from "../vault/file-service";
import type { Vault } from "obsidian";

export class CalendarService {
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

  hasDaily(date: Date): boolean {
    // Busca exata primeiro (caso ideal, sem normalização)
    if (this.files.exists(this.paths.dailyPath(date))) return true;

    // Fallback: busca por prefixo numérico de data no vault inteiro
    // Isso cobre casos onde a normalização mudou o nome (acentos, case, etc.)
    const info = this.paths.dateInfo(date);
    const prefix = `${info.yyyy}${info.mm}${info.dd}`;
    return this.vault.getMarkdownFiles().some((f) => f.basename.startsWith(prefix));
  }
}
