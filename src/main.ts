import { Notice, Plugin, type EventRef } from "obsidian";
import { registerCommands } from "./app/commands";
import { EventRegistry } from "./app/events";
import { StartupOrchestrator } from "./app/lifecycle";
import { CalendarService } from "./calendar/calendar-service";
import { CascadeSettingTab } from "./config/settings-tab";
import type { CascadeSettings } from "./config/schema";
import { mergeSettings } from "./config/defaults";
import { I18n } from "./i18n";
import { FrontmatterService } from "./notes/frontmatter-service";
import { NormalizerService } from "./notes/normalizer-service";
import { NoteService } from "./notes/note-service";
import { PathService } from "./notes/path-service";
import { TemplateService } from "./notes/template-service";
import { CheckboxMenu } from "./tasks/checkbox-menu";
import { MigrationService } from "./tasks/migration-service";
import { RecurrenceService } from "./tasks/recurrence-service";
import { StatusService } from "./tasks/status-service";
import { ScheduledTaskService } from "./tasks/scheduled-task-service";
import { TaskFamilyService } from "./tasks/task-family-service";
import { FileService } from "./vault/file-service";
import { LockService } from "./vault/lock-service";
import { RepairService } from "./vault/repair-service";

export default class CascadePlugin extends Plugin {
  declare settings: CascadeSettings;
  i18n!: I18n;
  private events?: EventRegistry;
  private checkboxMenu?: CheckboxMenu;

  async onload(): Promise<void> {
    await this.loadSettings();

    const paths = new PathService(this.settings);
    const files = new FileService(this.app.vault);
    const repair = new RepairService(paths);
    const templates = new TemplateService(this.app.vault, this.settings);
    const notes = new NoteService(this.app, paths, files, repair, templates);
    const calendar = new CalendarService(this.settings, paths, files);
    const recurrence = new RecurrenceService();
    const lock = new LockService();
    const migration = new MigrationService(this.settings, files, paths, recurrence, lock);
    const normalizer = new NormalizerService(this.app.vault, this.settings);
    const frontmatter = new FrontmatterService(this.app, this.settings);
    const statuses = new StatusService(this.settings);
    const taskFamilies = new TaskFamilyService(this.app.vault, this.settings);
    const scheduledTasks = new ScheduledTaskService(this.app);
    void taskFamilies.prime().catch((error) => console.error("Cascade task snapshot failed", error));

    this.i18n = new I18n(this.settings.language);
    this.addSettingTab(new CascadeSettingTab(this.app, this));
    registerCommands(this, this.i18n, notes, migration, calendar);
    this.addRibbonIcon("calendar-check", this.i18n.t("openToday"), () => {
      void (async () => {
        await notes.openToday();
        if (this.settings.runMigrationOnManualOpen) await migration.run();
      })().catch((error) => {
        console.error(error);
        new Notice(this.i18n.t("noticeOpenTodayFailed"));
      });
    });

    this.events = new EventRegistry(this.app.vault, normalizer, frontmatter, taskFamilies, scheduledTasks);
    this.events.register();

    this.checkboxMenu = new CheckboxMenu(this.app, statuses);
    this.checkboxMenu.register();

    const startup = new StartupOrchestrator(this.app.vault, this.settings, paths, notes, migration, normalizer);
    startup.registerIdleTracking((ref: EventRef) => this.registerEvent(ref));
    this.app.workspace.onLayoutReady(() => {
      void startup.run().catch((error) => console.error("Cascade startup failed", error));
    });
  }

  onunload(): void {
    this.events?.unregister();
    this.checkboxMenu?.unregister();
  }

  async loadSettings(): Promise<void> {
    this.settings = mergeSettings((await this.loadData()) as Partial<CascadeSettings> | null);
    this.i18n = new I18n(this.settings.language);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.i18n = new I18n(this.settings.language);
  }
}
