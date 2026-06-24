import { Notice, type App, type Plugin } from "obsidian";
import { CalendarView, CASCADE_CALENDAR_VIEW } from "../calendar/calendar-view";
import { CalendarService } from "../calendar/calendar-service";
import { MigrationService } from "../tasks/migration-service";
import { NoteService } from "../notes/note-service";
import { NormalizerService } from "../notes/normalizer-service";
import { FrontmatterService } from "../notes/frontmatter-service";
import type { I18n } from "../i18n";
import type { CascadeSettings } from "../config/schema";
import { ScheduledTaskService } from "../tasks/scheduled-task-service";

type CascadePluginLike = Plugin & { settings: CascadeSettings };

export async function toggleCalendar(app: App): Promise<void> {
  const leaves = app.workspace.getLeavesOfType(CASCADE_CALENDAR_VIEW);
  if (leaves.length) {
    app.workspace.detachLeavesOfType(CASCADE_CALENDAR_VIEW);
    return;
  }
  const leaf = app.workspace.getRightLeaf(false);
  await leaf?.setViewState({ type: CASCADE_CALENDAR_VIEW, active: true });
  if (leaf) app.workspace.revealLeaf(leaf);
}

export function registerCommands(
  plugin: CascadePluginLike,
  i18n: I18n,
  notes: NoteService,
  migration: MigrationService,
  calendar: CalendarService,
  scheduledTasks: ScheduledTaskService,
  normalizer: NormalizerService,
  frontmatter: FrontmatterService,
): void {
  plugin.addCommand({
    id: "open-today",
    name: i18n.t("openToday"),
    callback: async () => {
      try {
        await notes.openToday();
        if (plugin.settings.runMigrationOnManualOpen) await migration.run();
      } catch (error) {
        console.error(error);
        new Notice(i18n.t("noticeOpenTodayFailed"));
      }
    },
  });

  plugin.addCommand({
    id: "create-daily",
    name: i18n.t("createDaily"),
    callback: async () => {
      await notes.createDaily();
    },
  });

  plugin.addCommand({
    id: "reprocess",
    name: i18n.t("reprocess"),
    callback: async () => {
      await migration.run();
      new Notice(i18n.t("noticeMigrationDone"));
    },
  });

  plugin.addCommand({
    id: "copy-scheduled-task",
    name: i18n.t("copyScheduledTask"),
    callback: async () => {
      await scheduledTasks.copyFromActiveFile();
    },
  });

  plugin.addCommand({
    id: "normalize-all",
    name: i18n.t("normalizeAll"),
    callback: async () => {
      await normalizer.normalizeAll();
      new Notice(i18n.t("noticeNormalizeDone"));
    },
  });

  plugin.addCommand({
    id: "init-frontmatter",
    name: i18n.t("initFrontmatter"),
    callback: async () => {
      const count = await frontmatter.initializeAll();
      new Notice(i18n.t("noticeFrontmatterDone").replace("{count}", String(count)));
    },
  });

  plugin.addCommand({
    id: "toggle-calendar",
    name: i18n.t("toggleCalendar"),
    callback: () => toggleCalendar(plugin.app),
  });

  plugin.registerView(CASCADE_CALENDAR_VIEW, (leaf) => new CalendarView(leaf, notes, calendar, i18n, plugin.settings));
}
