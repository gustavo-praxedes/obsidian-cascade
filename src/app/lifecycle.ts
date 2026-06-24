import type { Vault, Workspace } from "obsidian";
import type { CascadeSettings } from "../config/schema";
import type { LogService } from "../logging/log-service";
import { NoteService } from "../notes/note-service";
import { NormalizerService } from "../notes/normalizer-service";
import { MigrationService } from "../tasks/migration-service";
import { PathService } from "../notes/path-service";

export class StartupOrchestrator {
  private lastVaultChange = Date.now();

  constructor(
    private readonly vault: Vault,
    private readonly workspace: Workspace,
    private readonly settings: CascadeSettings,
    private readonly paths: PathService,
    private readonly notes: NoteService,
    private readonly migration: MigrationService,
    private readonly normalizer: NormalizerService,
    private readonly log: LogService,
  ) {}

  registerIdleTracking(register: (eventRef: any) => void): void {
    register(this.vault.on("create", () => (this.lastVaultChange = Date.now())));
    register(this.vault.on("modify", () => (this.lastVaultChange = Date.now())));
    register(this.vault.on("delete", () => (this.lastVaultChange = Date.now())));
  }

  async run(manual = false): Promise<void> {
    if (!this.settings.startCascadeOnStartup && !manual) {
      this.log.startup.debug("Startup skipped (disabled)");
      return;
    }
    
    this.log.startup.info("Startup begin");
    await this.waitForStartupCondition();
    await this.openConfiguredNotes();
    if (this.settings.runMigrationOnStartup) await this.migration.run();
    if (this.settings.runNormalizerOnStartup) await this.normalizer.normalizeAll();
    this.log.startup.info("Startup complete");
  }

  private async openConfiguredNotes(): Promise<void> {
    const date = new Date();
    if (this.settings.openAnnualOnStartup && this.settings.yearlyEnabled) {
      const file = await this.notes.createAnnual(date);
      if (file) await this.openNote(file);
    }
    if (this.settings.openMonthlyOnStartup && this.settings.monthlyEnabled) {
      const file = await this.notes.createMonthly(date);
      if (file) await this.openNote(file);
    }
    if (this.settings.openWeeklyOnStartup && this.settings.weeklyEnabled) {
      const file = await this.notes.createWeekly(date);
      if (file) await this.openNote(file);
    }
    if (this.settings.openDailyOnStartup) {
      const file = await this.notes.createDaily(date);
      if (file) await this.openNote(file);
    }
  }

  private async openNote(file: import("obsidian").TFile): Promise<void> {
    const leaf = this.workspace.getLeaf(false);
    await leaf.openFile(file);
  }

  private async waitForStartupCondition(): Promise<void> {
    const condition = this.settings.startupWaitCondition;
    if (condition === "fixed") return;
    const started = Date.now();
    while (Date.now() - started < this.settings.startupWaitMaxSeconds * 1000) {
      const today = new Date();
      const dailyExists =
        this.vault.getAbstractFileByPath(this.paths.dailyPath(today)) ||
        this.vault.getMarkdownFiles().some((file) => file.basename.startsWith(this.paths.dailyPrefix(today)));
      const idle = Date.now() - this.lastVaultChange >= this.settings.startupVaultIdleSeconds * 1000;
      if (condition === "until-daily" && dailyExists) return;
      if (condition === "until-vault-idle" && idle) return;
      if (condition === "combined" && (dailyExists || idle)) return;
      await sleep(250);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
