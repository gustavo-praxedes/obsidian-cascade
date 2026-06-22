import type { Vault } from "obsidian";
import type { CascadeSettings } from "../config/schema";
import { NoteService } from "../notes/note-service";
import { NormalizerService } from "../notes/normalizer-service";
import { MigrationService } from "../tasks/migration-service";
import { PathService } from "../notes/path-service";

export class StartupOrchestrator {
  private lastVaultChange = Date.now();

  constructor(
    private readonly vault: Vault,
    private readonly settings: CascadeSettings,
    private readonly paths: PathService,
    private readonly notes: NoteService,
    private readonly migration: MigrationService,
    private readonly normalizer: NormalizerService,
  ) {}

  registerIdleTracking(register: (eventRef: any) => void): void {
    register(this.vault.on("create", () => (this.lastVaultChange = Date.now())));
    register(this.vault.on("modify", () => (this.lastVaultChange = Date.now())));
    register(this.vault.on("delete", () => (this.lastVaultChange = Date.now())));
  }

  async run(manual = false): Promise<void> {
    if (!this.settings.startCascadeOnStartup && !manual) {
      return;
    }
    
    await this.waitForStartupCondition();
    if (this.settings.openTodayOnStartup) await this.notes.openToday();
    else await this.notes.createDaily();
    if (this.settings.runMigrationOnStartup) await this.migration.run();
    if (this.settings.runNormalizerOnStartup) await this.normalizer.normalizeAll();
  }

  private async waitForStartupCondition(): Promise<void> {
    const condition = this.settings.startupWaitCondition;
    if (condition === "fixed") return;
    const started = Date.now();
    while (Date.now() - started < this.settings.startupWaitMaxSeconds * 1000) {
      const dailyExists = this.vault.getAbstractFileByPath(this.paths.dailyPath(new Date()));
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
