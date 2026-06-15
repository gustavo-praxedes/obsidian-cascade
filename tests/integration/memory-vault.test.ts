import { describe, expect, it, vi } from "vitest";
import { TFile, TFolder } from "obsidian";
import { DEFAULT_SETTINGS } from "../../src/config/defaults";
import { NoteService } from "../../src/notes/note-service";
import { PathService } from "../../src/notes/path-service";
import { TemplateService } from "../../src/notes/template-service";
import { MigrationService } from "../../src/tasks/migration-service";
import { RecurrenceService } from "../../src/tasks/recurrence-service";
import { FileService } from "../../src/vault/file-service";
import { LockService } from "../../src/vault/lock-service";
import { RepairService } from "../../src/vault/repair-service";

class MemoryVault {
  files = new Map<string, MemoryFile>();
  folders = new Set<string>();

  getAbstractFileByPath(path: string): MemoryFile | TFolder | null {
    if (this.files.has(path)) return this.files.get(path)!;
    if (this.folders.has(path)) return makeFolder(path);
    return null;
  }

  async read(file: TFile): Promise<string> {
    return this.files.get(file.path)?.content ?? "";
  }

  async modify(file: TFile, content: string): Promise<void> {
    this.files.set(file.path, makeFile(file.path, content));
  }

  async create(path: string, content: string): Promise<MemoryFile> {
    const file = makeFile(path, content);
    this.files.set(path, file);
    return file;
  }

  async createFolder(path: string): Promise<void> {
    this.folders.add(path);
  }

  getMarkdownFiles(): MemoryFile[] {
    return [...this.files.values()].filter((file) => file.extension === "md");
  }
}

type MemoryFile = TFile & { content: string };

function makeFile(path: string, content: string): MemoryFile {
  const file = new TFile() as MemoryFile;
  Object.assign(file, {
    path,
    content,
    stat: { ctime: Date.now(), mtime: Date.now() },
  });
  return file;
}

function makeFolder(path: string): TFolder {
  const folder = new TFolder();
  Object.assign(folder, { path });
  return folder;
}

describe("memory vault integration", () => {
  it("creates annual, monthly and daily notes with reference-compatible structure", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const paths = new PathService(DEFAULT_SETTINGS);
      const files = new FileService(vault as any);
      const repair = new RepairService(paths);
      const templates = new TemplateService(vault as any, DEFAULT_SETTINGS);
      const opened: string[] = [];
      const app = {
        vault,
        workspace: {
          getLeaf: () => ({
            openFile: async (file: TFile) => opened.push(file.path),
          }),
        },
      };
      const notes = new NoteService(app as any, paths, files, repair, templates);

      await notes.openDate(new Date(2026, 5, 15));

      expect(vault.files.has("01-AGENDA/2026/202600000000-2026.md")).toBe(true);
      expect(vault.files.has("01-AGENDA/2026/06/202606000000-JUNHO.md")).toBe(true);
      expect(vault.files.has("01-AGENDA/2026/06/202606150000-SEGUNDA-FEIRA.md")).toBe(true);
      expect(vault.files.get("01-AGENDA/2026/06/202606150000-SEGUNDA-FEIRA.md")?.content).toContain("# 15 - SEGUNDA-FEIRA");
      expect(opened).toEqual(["01-AGENDA/2026/06/202606150000-SEGUNDA-FEIRA.md"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("seeds recurring tasks into the monthly day section without modifying the recurring source", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      await files.write(settings.recurringTasksPath, "- [ ] Fazer designações 🔁 every year on June 15th 📅 2026-06-15 ⏰ 19:30 #tasks\n");
      await files.write(paths.annualPath(new Date(2026, 5, 15)), paths.renderAnnualLog(new Date(2026, 5, 15)));
      await files.write(paths.monthlyPath(new Date(2026, 5, 15)), paths.renderMonthlyLog(new Date(2026, 5, 15)));
      await files.write(paths.dailyPath(new Date(2026, 5, 15)), paths.renderDailyLog(new Date(2026, 5, 15)));

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService());
      await migration.run(new Date(2026, 5, 15));

      const monthly = await files.read(paths.monthlyPath(new Date(2026, 5, 15)));
      const daily = await files.read(paths.dailyPath(new Date(2026, 5, 15)));
      const source = await files.read(settings.recurringTasksPath);

      expect(source).toBe("- [ ] Fazer designações 🔁 every year on June 15th 📅 2026-06-15 ⏰ 19:30 #tasks\n");
      expect(monthly).toContain("## [[01-AGENDA/2026/06/202606150000-SEGUNDA-FEIRA|15 - SEGUNDA-FEIRA]]");
      expect(monthly).toContain("- [>] Fazer designações 📅 2026-06-15 ⏰ 19:30 #tasks");
      expect(daily).toContain("- [ ] Fazer designações 📅 2026-06-15 ⏰ 19:30 #tasks");
    } finally {
      vi.useRealTimers();
    }
  });

  it("carries pending tasks from yesterday into today's H1 body", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const yesterday = new Date(2026, 5, 14);
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "");
      await files.write(paths.annualPath(today), paths.renderAnnualLog(today));
      await files.write(paths.monthlyPath(today), paths.renderMonthlyLog(today));
      await files.write(paths.dailyPath(today), paths.renderDailyLog(today));
      await files.write(paths.dailyPath(yesterday), `${paths.renderDailyLog(yesterday)}- [ ] Ligar para cliente\n- [ ] Compra agendada ⏳ 2026-06-14\n`);

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService());
      await migration.run(today);

      const todayText = await files.read(paths.dailyPath(today));
      const yesterdayText = await files.read(paths.dailyPath(yesterday));
      expect(todayText).toContain("- [ ] Ligar para cliente");
      expect(yesterdayText).toContain("- [-] Compra agendada ⏳ 2026-06-14");
    } finally {
      vi.useRealTimers();
    }
  });
});
