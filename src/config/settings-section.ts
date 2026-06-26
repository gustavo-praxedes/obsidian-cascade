import type { App } from "obsidian";
import type CascadePlugin from "../main";
import type { CascadeSettings } from "./schema";

export interface SectionContext {
  app: App;
  plugin: CascadePlugin;
  settings: CascadeSettings;
  container: HTMLElement;
  save(): Promise<void>;
  refresh(): void;
  t(key: string): string;
}

export interface SettingsSection {
  readonly id: string;
  readonly icon: string;
  readonly labelKey: string;
  render(ctx: SectionContext): void;
}

export const SECTIONS_META: { id: string; icon: string; labelKey: string }[] = [
  { id: "general", icon: "⚙️", labelKey: "sectionGeneral" },
  { id: "agenda", icon: "📅", labelKey: "sectionAgenda" },
  { id: "migration", icon: "🔄", labelKey: "sectionMigration" },
  { id: "normalization", icon: "📝", labelKey: "sectionNormalization" },
  { id: "tasks", icon: "✅", labelKey: "sectionTasks" },
  { id: "checkbox", icon: "🏷️", labelKey: "sectionCheckbox" },
  { id: "calendar", icon: "📆", labelKey: "sectionCalendar" },
  { id: "frontmatter", icon: "📄", labelKey: "sectionFrontmatter" },
  { id: "advanced", icon: "📊", labelKey: "sectionAdvanced" },
];

export function isSectionVisible(id: string, settings: CascadeSettings): boolean {
  switch (id) {
    case "general":
    case "agenda":
    case "checkbox":
    case "calendar":
      return true;
    case "migration":
    case "tasks":
      return settings.migrationEnabled;
    case "normalization":
      return settings.normalizerEnabled;
    case "frontmatter":
      return settings.frontmatterEnabled;
    case "advanced":
      return settings.loggingEnabled;
    default:
      return false;
  }
}

export function createSectionContext(
  app: App,
  plugin: CascadePlugin,
  container: HTMLElement,
  refresh: () => void,
): SectionContext {
  return {
    app,
    plugin,
    settings: plugin.settings,
    container,
    save: async () => {
      await plugin.saveSettings();
    },
    refresh,
    t: (key) => plugin.i18n.t(key as any),
  };
}
