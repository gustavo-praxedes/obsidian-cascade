import { Notice, Plugin, type EventRef } from "obsidian";
import { registerCommands, toggleCalendar } from "./app/commands";
import { EventRegistry } from "./app/events";
import { StartupOrchestrator } from "./app/lifecycle";
import { CalendarService } from "./calendar/calendar-service";
import { CascadeSettingTab } from "./config/settings-tab";
import type { CascadeSettings } from "./config/schema";
import { mergeSettings } from "./config/defaults";
import { I18n } from "./i18n";
import { LogService } from "./logging/log-service";
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
  log!: LogService;
  private events?: EventRegistry;
  private checkboxMenu?: CheckboxMenu;
  private calendarRibbonEl?: HTMLElement;
  private toggleCalendarCallback?: () => void;

  async onload(): Promise<void> {
    await this.loadSettings();

    const paths = new PathService(this.settings);
    const files = new FileService(this.app.vault);
    this.log = new LogService(this.settings, files);
    const repair = new RepairService(paths);
    const templates = new TemplateService(this.app.vault, this.settings);
    const notes = new NoteService(this.app, paths, files, repair, templates, this.settings);
    const calendar = new CalendarService(this.settings, paths, files, this.app.vault);
    const recurrence = new RecurrenceService();
    const lock = new LockService();
    const migration = new MigrationService(this.settings, files, paths, recurrence, lock, this.log);
    const normalizer = new NormalizerService(this.app, this.settings, this.log);
    const frontmatter = new FrontmatterService(this.app, this.settings);
    const statuses = new StatusService(this.settings);
    const taskFamilies = new TaskFamilyService(this.app.vault, this.settings);
    const scheduledTasks = new ScheduledTaskService(this.app);
    void taskFamilies.prime().catch((error) => console.error("Cascade task snapshot failed", error));

    this.i18n = new I18n(this.settings.language);
    this.addSettingTab(new CascadeSettingTab(this.app, this));
    registerCommands(this, this.i18n, notes, migration, calendar, scheduledTasks, normalizer);
    this.addRibbonIcon("calendar-check", this.i18n.t("openToday"), () => {
      void (async () => {
        await notes.openToday();
        if (this.settings.runMigrationOnManualOpen) await migration.run();
      })().catch((error) => {
        console.error(error);
        new Notice(this.i18n.t("noticeOpenTodayFailed"));
      });
    });

    this.toggleCalendarCallback = () => toggleCalendar(this.app);

    this.updateCalendarRibbon();

    this.events = new EventRegistry(this.app.vault, normalizer, frontmatter, taskFamilies);
    this.events.register();

    this.checkboxMenu = new CheckboxMenu(this.app, statuses);
    this.checkboxMenu.register();

    const startup = new StartupOrchestrator(this.app.vault, this.app.workspace, this.settings, paths, notes, migration, normalizer, this.log);
    startup.registerIdleTracking((ref: EventRef) => this.registerEvent(ref));
    this.app.workspace.onLayoutReady(() => {
      void startup.run().catch((error) => {
        this.log.error(`Startup failed: ${error}`);
        console.error("Cascade startup failed", error);
      });
    });

    this.addCommand({
      id: "start-cascade",
      name: this.i18n.t("startCascadeButton"),
      callback: async () => {
        try {
          await startup.run(true);
          new Notice(this.i18n.t("noticeMigrationDone") ?? "Cascade iniciado");
        } catch (error) {
          console.error(error);
          new Notice(this.i18n.t("errorStartingCascade"));
        }
      },
    });
  }

  onunload(): void {
    this.events?.unregister();
    this.checkboxMenu?.unregister();
  }

  updateCalendarRibbon(): void {
    this.calendarRibbonEl?.remove();
    this.calendarRibbonEl = undefined;
    if (this.settings.calendarShowRibbonButton) {
      this.calendarRibbonEl = this.addRibbonIcon("calendar-days", this.i18n.t("openCalendar"), () => {
        void this.toggleCalendarCallback?.();
      });
    }
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
