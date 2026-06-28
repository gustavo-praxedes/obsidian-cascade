import { describe, expect, it, vi } from "vitest";
import { TFile, TFolder } from "obsidian";
import { DEFAULT_SETTINGS } from "../../src/config/defaults";
import { LogService } from "../../src/logging/log-service";
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
      const notes = new NoteService(app as any, paths, files, repair, templates, DEFAULT_SETTINGS);

      await notes.openDate(new Date(2026, 5, 15));

      expect(vault.files.has("202600000000-2026.md")).toBe(true);
      expect(vault.files.has("202606000000-JUNHO.md")).toBe(true);
      const dailyPath = paths.dailyPath(new Date(2026, 5, 15));
      expect(vault.files.has(dailyPath)).toBe(true);
      expect(vault.files.get(dailyPath)?.content).toContain("# 15 - SEGUNDA-FEIRA");
      expect(opened).toEqual([dailyPath]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reuses an existing normalized daily note instead of creating an accented duplicate", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        agendaRoot: "AGENDA",
        dailyFolder: "DIA",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const repair = new RepairService(paths);
      const templates = new TemplateService(vault as any, settings);
      const opened: string[] = [];
      const app = {
        vault,
        workspace: {
          getLeaf: () => ({
            openFile: async (file: TFile) => opened.push(file.path),
          }),
        },
      };
      const notes = new NoteService(app as any, paths, files, repair, templates, settings);
      const normalizedPath = "AGENDA/DIA/202606160001-TERCA-FEIRA.md";

      await files.write("NOTAS/202606161030-NOTA-COMUM.md", "# Nota comum\n");
      await files.write(normalizedPath, paths.renderDailyLog(new Date(2026, 5, 16)));
      await notes.openDate(new Date(2026, 5, 16));

      expect(vault.files.has(normalizedPath)).toBe(true);
      expect(vault.files.has("AGENDA/DIA/202606160001-TERÇA-FEIRA.md")).toBe(false);
      expect(opened).toEqual([normalizedPath]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("creates notes and migrates recurring tasks with custom folders and weekly notes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 16, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        agendaRoot: "PLANEJAMENTO/REGISTROS",
        recurringTasksPath: "CONFIGURACOES/TAREFAS/RECORRENTES.md",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const repair = new RepairService(paths);
      const templates = new TemplateService(vault as any, settings);
      const opened: string[] = [];
      const app = {
        vault,
        workspace: {
          getLeaf: () => ({
            openFile: async (file: TFile) => opened.push(file.path),
          }),
        },
      };
      const notes = new NoteService(app as any, paths, files, repair, templates, settings);
      const date = new Date(2026, 5, 16);

      await files.write(settings.recurringTasksPath, "- [ ] Estudo em familia \u{1F501} every week on Tuesday \u{1F4C5} 2026-06-16 \u23F0 19:00 #tasks\n");
      await notes.openDate(date);
      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(date);

      expect(vault.files.has("PLANEJAMENTO/REGISTROS/202600000000-2026.md")).toBe(true);
      expect(vault.files.has("PLANEJAMENTO/REGISTROS/202606000000-JUNHO.md")).toBe(true);
      expect(vault.files.has(paths.weeklyPath(date))).toBe(true);
      const dailyPath = paths.dailyPath(date);
      expect(vault.files.has(dailyPath)).toBe(true);
      expect(vault.files.get(dailyPath)?.content).toContain("Estudo em familia");
      expect(opened).toEqual([dailyPath]);
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
        weeklyEnabled: false,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      await files.write(settings.recurringTasksPath, "- [ ] Fazer designaÃ§Ãµes \u{1F501} every year on June 15th \u{1F4C5} 2026-06-15 \u23F0 19:30 #tasks\n");
      await files.write(paths.annualPath(new Date(2026, 5, 15)), paths.renderAnnualLog(new Date(2026, 5, 15)));
      await files.write(paths.monthlyPath(new Date(2026, 5, 15)), paths.renderMonthlyLog(new Date(2026, 5, 15)));
      await files.write(paths.dailyPath(new Date(2026, 5, 15)), paths.renderDailyLog(new Date(2026, 5, 15)));

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(new Date(2026, 5, 15));

      const monthly = await files.read(paths.monthlyPath(new Date(2026, 5, 15)));
      const daily = await files.read(paths.dailyPath(new Date(2026, 5, 15)));
      const annual = await files.read(paths.annualPath(new Date(2026, 5, 15)));
      const source = await files.read(settings.recurringTasksPath);

      expect(source).toBe("- [ ] Fazer designaÃ§Ãµes \u{1F501} every year on June 15th \u{1F4C5} 2026-06-15 \u23F0 19:30 #tasks\n");
      expect(annual).toContain("- [>] Fazer designaÃ§Ãµes \u{1F501} every year on June 15th \u{1F4C5} 2026-06-15 \u23F0 19:30 #tasks");
      expect(monthly).toContain("## [[202606150001-SEGUNDA-FEIRA|15 - SEGUNDA-FEIRA]]");
      expect(monthly).toContain("- [>] Fazer designaÃ§Ãµes \u{1F4C5} 2026-06-15 \u23F0 19:30 #tasks");
      expect(monthly).not.toContain("#tasks\n## [[01-AGENDA/2026/06/202606160001-TER");
      expect(daily).toContain("- [ ] Fazer designaÃ§Ãµes \u{1F4C5} 2026-06-15 \u23F0 19:30 #tasks");
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
        weeklyEnabled: false,
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
      await files.write(paths.dailyPath(yesterday), `${paths.renderDailyLog(yesterday)}- [ ] Ligar para cliente\n- [ ] Compra agendada \u23F3 2026-06-14\n`);

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      const todayText = await files.read(paths.dailyPath(today));
      const yesterdayText = await files.read(paths.dailyPath(yesterday));
      expect(todayText).toContain("- [ ] Ligar para cliente");
      expect(yesterdayText).toContain("- [-] Compra agendada \u23F3 2026-06-14");
      expect(yesterdayText).toContain("- [>] Ligar para cliente");
    } finally {
      vi.useRealTimers();
    }
  });

  it("carries only open child tasks and marks open source children as migrated", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        weeklyEnabled: false,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
        taskGlobalFilter: "",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const yesterday = new Date(2026, 5, 14);
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "");
      await files.write(paths.annualPath(today), paths.renderAnnualLog(today));
      await files.write(paths.monthlyPath(today), paths.renderMonthlyLog(today));
      await files.write(paths.dailyPath(today), paths.renderDailyLog(today));
      await files.write(
        paths.dailyPath(yesterday),
        [
          paths.renderDailyLog(yesterday).trimEnd(),
          "- [ ] Projeto",
          "\t- [ ] Filha aberta",
          "\t- [x] Filha concluida",
          "\t- [>] Filha migrada",
          "",
        ].join("\n"),
      );

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      const todayText = await files.read(paths.dailyPath(today));
      const yesterdayText = await files.read(paths.dailyPath(yesterday));
      expect(todayText).toContain(["- [ ] Projeto", "\t- [ ] Filha aberta"].join("\n"));
      expect(todayText).not.toContain("Filha concluida");
      expect(todayText).not.toContain("Filha migrada");
      expect(yesterdayText).toContain(["- [>] Projeto", "\t- [>] Filha aberta", "\t- [x] Filha concluida", "\t- [>] Filha migrada"].join("\n"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("carries in-progress tasks and in-progress child tasks from yesterday", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
        taskGlobalFilter: "",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const yesterday = new Date(2026, 5, 14);
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "");
      await files.write(paths.annualPath(today), paths.renderAnnualLog(today));
      await files.write(paths.monthlyPath(today), paths.renderMonthlyLog(today));
      await files.write(paths.dailyPath(today), paths.renderDailyLog(today));
      await files.write(
        paths.dailyPath(yesterday),
        [
          paths.renderDailyLog(yesterday).trimEnd(),
          "- [/] Projeto em progresso",
          "\t- [/] Filha em progresso",
          "",
        ].join("\n"),
      );

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      const todayText = await files.read(paths.dailyPath(today));
      const yesterdayText = await files.read(paths.dailyPath(yesterday));
      expect(todayText).toContain(["- [/] Projeto em progresso", "\t- [/] Filha em progresso"].join("\n"));
      expect(yesterdayText).toContain(["- [>] Projeto em progresso", "\t- [>] Filha em progresso"].join("\n"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("carries open child tasks under already migrated parents from yesterday", async () => {
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
      await files.write(
        paths.dailyPath(yesterday),
        [
          paths.renderDailyLog(yesterday).trimEnd(),
          "- [>] Projeto",
          "\t- [ ] Filha aberta",
          "\t- [/] Filha em progresso",
          "",
        ].join("\n"),
      );

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      const todayText = await files.read(paths.dailyPath(today));
      const yesterdayText = await files.read(paths.dailyPath(yesterday));
      expect(todayText).toContain("- [ ] Filha aberta");
      expect(todayText).toContain("- [/] Filha em progresso");
      expect(todayText).not.toContain("- [ ] Projeto");
      expect(yesterdayText).toContain(["- [>] Projeto", "\t- [>] Filha aberta", "\t- [>] Filha em progresso"].join("\n"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("only carries open tasks inside the configured previous-day window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
        previousDayMigrationLookbackDays: 2,
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "");
      await files.write(paths.annualPath(today), paths.renderAnnualLog(today));
      await files.write(paths.monthlyPath(today), paths.renderMonthlyLog(today));
      await files.write(paths.dailyPath(today), paths.renderDailyLog(today));
      await files.write(paths.dailyPath(new Date(2026, 5, 14)), `${paths.renderDailyLog(new Date(2026, 5, 14))}- [ ] Vem de ontem\n- [i] Nao vem status i\n`);
      await files.write(paths.dailyPath(new Date(2026, 5, 13)), `${paths.renderDailyLog(new Date(2026, 5, 13))}- [ ] Vem de anteontem\n`);
      await files.write(paths.dailyPath(new Date(2026, 5, 12)), `${paths.renderDailyLog(new Date(2026, 5, 12))}- [ ] Antiga demais\n`);

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      const todayText = await files.read(paths.dailyPath(today));
      expect(todayText).toContain("- [ ] Vem de ontem");
      expect(todayText).toContain("- [ ] Vem de anteontem");
      expect(todayText).not.toContain("Nao vem status i");
      expect(todayText).not.toContain("Antiga demais");
    } finally {
      vi.useRealTimers();
    }
  });

  it("carries due-date tasks from yesterday even when their due date is older", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
        previousDayMigrationLookbackDays: 1,
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const today = new Date(2026, 5, 15);
      const yesterday = new Date(2026, 5, 14);
      await files.write(settings.recurringTasksPath, "");
      await files.write(paths.annualPath(today), paths.renderAnnualLog(today));
      await files.write(paths.monthlyPath(today), paths.renderMonthlyLog(today));
      await files.write(paths.dailyPath(today), paths.renderDailyLog(today));
      await files.write(
        paths.dailyPath(yesterday),
        `${paths.renderDailyLog(yesterday)}- [ ] Sem data vem\n- [ ] Data antiga nao vem \u{1F4C5} 2026-06-01\n- [ ] Data de ontem vem \u{1F4C5} 2026-06-14\n`,
      );

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      const todayText = await files.read(paths.dailyPath(today));
      expect(todayText).toContain("- [ ] Sem data vem");
      expect(todayText).toContain("- [ ] Data de ontem vem \u{1F4C5} 2026-06-14");
      expect(todayText).toContain("- [ ] Data antiga nao vem \u{1F4C5} 2026-06-01");
    } finally {
      vi.useRealTimers();
    }
  });

  it("removes out-of-day scheduled tasks from today's daily note", async () => {
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
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "");
      await files.write(paths.annualPath(today), paths.renderAnnualLog(today));
      await files.write(paths.monthlyPath(today), paths.renderMonthlyLog(today));
      await files.write(
        paths.dailyPath(today),
        `${paths.renderDailyLog(today)}- [ ] Futura nao fica \u23F3 2026-06-25\n- [ ] Passada nao fica \u23F3 2026-06-14\n- [ ] Vencimento antigo fica \u{1F4C5} 2026-06-01\n`,
      );

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      const todayText = await files.read(paths.dailyPath(today));
      expect(todayText).not.toContain("Futura nao fica");
      expect(todayText).not.toContain("Passada nao fica");
      expect(todayText).toContain("- [ ] Vencimento antigo fica \u{1F4C5} 2026-06-01");
    } finally {
      vi.useRealTimers();
    }
  });

  it("restores only current-day monthly tasks when a daily note is recreated", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        weeklyEnabled: false,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "");
      await files.write(paths.annualPath(today), paths.renderAnnualLog(today));
      let monthly = paths.renderMonthlyLog(today);
      monthly = monthly.replace(
        "## [[202606010001-SEGUNDA-FEIRA|01 - SEGUNDA-FEIRA]]\n",
        "## [[202606010001-SEGUNDA-FEIRA|01 - SEGUNDA-FEIRA]]\n\n- [>] Tarefa antiga do dia 1\n",
      );
      monthly = monthly.replace(
        "## [[202606150001-SEGUNDA-FEIRA|15 - SEGUNDA-FEIRA]]\n",
        "## [[202606150001-SEGUNDA-FEIRA|15 - SEGUNDA-FEIRA]]\n\n- [>] Tarefa atual jÃ¡ marcada no mensal\n",
      );
      await files.write(paths.monthlyPath(today), monthly);
      await files.write(paths.dailyPath(today), paths.renderDailyLog(today));

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      const todayText = await files.read(paths.dailyPath(today));
      expect(todayText).toContain("- [ ] Tarefa atual jÃ¡ marcada no mensal");
      expect(todayText).not.toContain("Tarefa antiga do dia 1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("creates daily notes for lost days when opening after multiple days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        weeklyEnabled: false,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
        previousDayMigrationLookbackDays: 3,
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "");
      await files.write(paths.annualPath(today), paths.renderAnnualLog(today));
      await files.write(paths.monthlyPath(today), paths.renderMonthlyLog(today));

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      expect(vault.files.has(paths.dailyPath(new Date(2026, 5, 14)))).toBe(true);
      expect(vault.files.has(paths.dailyPath(new Date(2026, 5, 13)))).toBe(true);
      expect(vault.files.has(paths.dailyPath(new Date(2026, 5, 12)))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("migrates annual tasks into lost daily notes via cascade", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        weeklyEnabled: false,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
        previousDayMigrationLookbackDays: 2,
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const today = new Date(2026, 5, 15);
      const yesterday = new Date(2026, 5, 14);
      await files.write(settings.recurringTasksPath, "");
      await files.write(paths.annualPath(today), paths.renderAnnualLog(today));
      await files.write(paths.monthlyPath(today), paths.renderMonthlyLog(today));

      const monthly = paths.renderMonthlyLog(today);
      const updatedMonthly = monthly.replace(
        `## [[${paths.dailyPath(yesterday).replace(/\.md$/, "")}|14 - DOMINGO]]\n`,
        `## [[${paths.dailyPath(yesterday).replace(/\.md$/, "")}|14 - DOMINGO]]\n\n- [ ] Tarefa do mensal para ontem\n`,
      );
      await files.write(paths.monthlyPath(today), updatedMonthly);

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      const yesterdayText = await files.read(paths.dailyPath(yesterday));
      expect(yesterdayText).toContain("- [>] Tarefa do mensal para ontem");
      const todayText = await files.read(paths.dailyPath(today));
      expect(todayText).toContain("- [ ] Tarefa do mensal para ontem");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ensures lost weekly notes exist when weekly is enabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
        previousDayMigrationLookbackDays: 10,
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "");
      await files.write(paths.annualPath(today), paths.renderAnnualLog(today));
      await files.write(paths.monthlyPath(today), paths.renderMonthlyLog(today));

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      const lastWeek = new Date(2026, 5, 8);
      expect(vault.files.has(paths.weeklyPath(lastWeek))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("carries tasks from lost days into subsequent days", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        weeklyEnabled: false,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
        previousDayMigrationLookbackDays: 3,
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "");
      await files.write(paths.annualPath(today), paths.renderAnnualLog(today));
      await files.write(paths.monthlyPath(today), paths.renderMonthlyLog(today));
      const threeDaysAgo = new Date(2026, 5, 12);
      await files.write(paths.dailyPath(threeDaysAgo), `${paths.renderDailyLog(threeDaysAgo)}- [ ] Tarefa antiga de 3 dias\n`);

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      const threeDaysAgoText = await files.read(paths.dailyPath(threeDaysAgo));
      expect(threeDaysAgoText).toContain("- [>] Tarefa antiga de 3 dias");
      const todayText = await files.read(paths.dailyPath(today));
      expect(todayText).toContain("- [ ] Tarefa antiga de 3 dias");
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips annual when yearlyEnabled=false and seeds recurring into monthly", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        weeklyEnabled: false,
        yearlyEnabled: false,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "- [ ] Tarefa recorrente \u{1F501} every week on Monday \u{1F4C5} 2026-06-15 #tasks\n");

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      expect(vault.files.has(paths.annualPath(today))).toBe(false);
      expect(vault.files.has(paths.monthlyPath(today))).toBe(true);
      const monthly = await files.read(paths.monthlyPath(today));
      expect(monthly).toContain("Tarefa recorrente");
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips monthly when monthlyEnabled=false and seeds recurring into weekly", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        monthlyEnabled: false,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "- [ ] Tarefa semanal \u{1F501} every week on Monday \u{1F4C5} 2026-06-15 #tasks\n");

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      expect(vault.files.has(paths.monthlyPath(today))).toBe(false);
      expect(vault.files.has(paths.weeklyPath(today))).toBe(true);
      const weekly = await files.read(paths.weeklyPath(today));
      expect(weekly).toContain("Tarefa semanal");
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips weekly when weeklyEnabled=false and migrates from monthly to daily", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        weeklyEnabled: false,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "- [ ] Tarefa diaria \u{1F501} every day \u{1F4C5} 2026-06-15 #tasks\n");

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      const dailyPath = paths.dailyPath(today);
      expect(vault.files.has(dailyPath)).toBe(true);
      const daily = await files.read(dailyPath);
      expect(daily).toContain("Tarefa diaria");
    } finally {
      vi.useRealTimers();
    }
  });

  it("skips annual and monthly when both disabled and seeds recurring into daily", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        yearlyEnabled: false,
        monthlyEnabled: false,
        weeklyEnabled: false,
        recurringTasksPath: "02-ARQUIVO/TAREFAS/RECORRENTES.md",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const today = new Date(2026, 5, 15);
      await files.write(settings.recurringTasksPath, "- [ ] Tarefa direta \u{1F501} every day \u{1F4C5} 2026-06-15 #tasks\n");

      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(today);

      expect(vault.files.has(paths.annualPath(today))).toBe(false);
      expect(vault.files.has(paths.monthlyPath(today))).toBe(false);
      const dailyPath = paths.dailyPath(today);
      expect(vault.files.has(dailyPath)).toBe(true);
      const daily = await files.read(dailyPath);
      expect(daily).toContain("Tarefa direta");
    } finally {
      vi.useRealTimers();
    }
  });

  it("cascades same-name recurring tasks on different weekdays through the full chain", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 28, 8, 0));
    try {
      const vault = new MemoryVault();
      const settings = {
        ...DEFAULT_SETTINGS,
        recurringTasksPath: "TAREFAS/RECORRENTES.md",
      };
      const paths = new PathService(settings);
      const files = new FileService(vault as any);
      const repair = new RepairService(paths);
      const templates = new TemplateService(vault as any, settings);
      const app = {
        vault,
        workspace: {
          getLeaf: () => ({
            openFile: async () => {},
          }),
        },
      };
      const notes = new NoteService(app as any, paths, files, repair, templates, settings);

      const saturday = "- Campo \u{1F501} every week on Saturday \u23F0 08:00 \u{1F51A}";
      const sunday = "- Campo \u{1F501} every week on Sunday \u23F0 08:00 \u{1F51A}";
      await files.write(settings.recurringTasksPath, `${saturday}\n${sunday}\n`);

      await notes.createDaily(new Date(2026, 5, 28));
      const migration = new MigrationService(settings, files, paths, new RecurrenceService(), new LockService(), new LogService({ ...DEFAULT_SETTINGS, loggingEnabled: false }, files));
      await migration.run(new Date(2026, 5, 28));

      const annual = await files.read(paths.annualPath(new Date(2026, 5, 28)));
      expect(annual).toContain("every week on Saturday");
      expect(annual).toContain("every week on Sunday");

      const monthly = await files.read(paths.monthlyPath(new Date(2026, 5, 28)));
      expect(monthly).toContain("\u{1F4C5} 2026-06-27");
      expect(monthly).toContain("\u{1F4C5} 2026-06-28");

      const weeklyPath = paths.weeklyPath(new Date(2026, 5, 28));
      const weekly = await files.read(weeklyPath);
      expect(weekly).toContain("27 - S\u00C1BADO");
      expect(weekly).toContain("28 - DOMINGO");
      expect(weekly).toContain("Campo");
      const sundaySection = weekly.split("28 - DOMINGO")[1] ?? "";
      expect(sundaySection).toContain("Campo");

      const dailySaturday = await files.read(paths.dailyPath(new Date(2026, 5, 27)));
      expect(dailySaturday).toContain("Campo");

      const dailySunday = await files.read(paths.dailyPath(new Date(2026, 5, 28)));
      expect(dailySunday).toContain("Campo");
    } finally {
      vi.useRealTimers();
    }
  });

});
