import { Notice, type Plugin } from "obsidian";
import { CalendarView, CASCADE_CALENDAR_VIEW } from "../calendar/calendar-view";
import { CalendarService } from "../calendar/calendar-service";
import { MigrationService } from "../tasks/migration-service";
import { NoteService } from "../notes/note-service";
import type { I18n } from "../i18n";
import type { CascadeSettings } from "../config/schema";

type CascadePluginLike = Plugin & { settings: CascadeSettings };

export function registerCommands(plugin: CascadePluginLike, i18n: I18n, notes: NoteService, migration: MigrationService, calendar: CalendarService): void {
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
    id: "toggle-calendar",
    name: i18n.t("toggleCalendar"),
    callback: async () => {
      const leaves = plugin.app.workspace.getLeavesOfType(CASCADE_CALENDAR_VIEW);
      if (leaves.length) {
        plugin.app.workspace.detachLeavesOfType(CASCADE_CALENDAR_VIEW);
        return;
      }
      const leaf = plugin.app.workspace.getRightLeaf(false);
      await leaf?.setViewState({ type: CASCADE_CALENDAR_VIEW, active: true });
      if (leaf) plugin.app.workspace.revealLeaf(leaf);
    },
  });

  plugin.registerView(CASCADE_CALENDAR_VIEW, (leaf) => new CalendarView(leaf, notes, calendar));
}
