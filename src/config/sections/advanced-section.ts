import { Notice, Setting } from "obsidian";
import type { SectionContext, SettingsSection } from "../settings-section";
import { SettingBuilder } from "../setting-builder";
import { mergeSettings } from "../defaults";
import type { CascadeSettings, SettingsPreset } from "../schema";

const SECTION_DOCS: Record<string, string> = {
  general: "https://github.com/anomalyco/obsidian-cascade/wiki/General",
  agenda: "https://github.com/anomalyco/obsidian-cascade/wiki/Agenda",
  migration: "https://github.com/anomalyco/obsidian-cascade/wiki/Migration",
  normalization: "https://github.com/anomalyco/obsidian-cascade/wiki/Normalization",
  tasks: "https://github.com/anomalyco/obsidian-cascade/wiki/Tasks",
  checkbox: "https://github.com/anomalyco/obsidian-cascade/wiki/Checkbox",
  calendar: "https://github.com/anomalyco/obsidian-cascade/wiki/Calendar",
  frontmatter: "https://github.com/anomalyco/obsidian-cascade/wiki/Frontmatter",
  advanced: "https://github.com/anomalyco/obsidian-cascade/wiki/Advanced",
};

export class AdvancedSection implements SettingsSection {
  readonly id = "advanced";
  readonly icon = "📊";
  readonly labelKey = "sectionAdvanced";

  render(ctx: SectionContext): void {
    this.renderCard(ctx, "📊", ctx.t("sectionInternalLog"), () => {
      if (ctx.settings.loggingEnabled) {
        new Setting(ctx.container)
          .setName(ctx.t("loggingFolder"))
          .setDesc(ctx.t("loggingFolderDesc"))
          .addText((text) =>
            text
              .setPlaceholder(ctx.t("loggingFolderPlaceholder"))
              .setValue(ctx.settings.loggingFolder)
              .onChange(async (value) => {
                ctx.settings.loggingFolder = value.trim();
                await ctx.save();
              }),
          );

        new Setting(ctx.container)
          .setName(ctx.t("loggingFilename"))
          .setDesc(ctx.t("loggingFilenameDesc"))
          .addText((text) =>
            text
              .setPlaceholder("cascade-log.md")
              .setValue(ctx.settings.loggingFilename)
              .onChange(async (value) => {
                ctx.settings.loggingFilename = value.trim() || "cascade-log.md";
                await ctx.save();
              }),
          );

        new SettingBuilder(ctx)
          .name(ctx.t("loggingRetentionDays"))
          .tooltip(ctx.t("tooltipLogRetention"))
          .textCustom(
            () => String(ctx.settings.loggingRetentionDays),
            (v) => {
              ctx.settings.loggingRetentionDays = Number(v) || 0;
            },
          );

        new SettingBuilder(ctx)
          .name(ctx.t("loggingStartup"))
          .tooltip(ctx.t("tooltipLoggingStartup"))
          .toggle("loggingStartup");
        new SettingBuilder(ctx)
          .name(ctx.t("loggingMigration"))
          .tooltip(ctx.t("tooltipLoggingMigration"))
          .toggle("loggingMigration");
        new SettingBuilder(ctx)
          .name(ctx.t("loggingNormalization"))
          .tooltip(ctx.t("tooltipLoggingNormalization"))
          .toggle("loggingNormalizer");
        new SettingBuilder(ctx)
          .name(ctx.t("loggingErrors"))
          .tooltip(ctx.t("tooltipLoggingErrors"))
          .toggle("loggingErrors");
      }
    });

    this.renderPresets(ctx);
    this.renderImportExportReset(ctx);
    this.renderSyncInfo(ctx);
    this.renderDocLinks(ctx);
  }

  /* ============================================
     PRESETS
     ============================================ */

  private renderPresets(ctx: SectionContext): void {
    this.renderCard(ctx, "🎯", ctx.t("presetsTitle"), () => {
      const presets = ctx.settings.presets ?? [];

      if (presets.length > 0) {
        const list = ctx.container.createDiv({ cls: "cascade-presets-list" });
        for (const [index, preset] of presets.entries()) {
          const row = list.createDiv({ cls: "cascade-preset-row" });
          const info = row.createDiv({ cls: "cascade-preset-info" });
          info.createDiv({ cls: "cascade-preset-name", text: preset.name });
          info.createDiv({
            cls: "cascade-preset-date",
            text: new Date(preset.createdAt).toLocaleDateString(),
          });

          const actions = row.createDiv({ cls: "cascade-preset-actions" });
          const loadBtn = actions.createEl("button", {
            cls: "cascade-settings-btn cascade-settings-btn--primary",
            text: ctx.t("presetLoad"),
          });
          loadBtn.addEventListener("click", () => this.loadPreset(ctx, preset));

          const deleteBtn = actions.createEl("button", {
            cls: "cascade-settings-btn cascade-settings-btn--danger",
            text: "✕",
          });
          deleteBtn.addEventListener("click", () => this.deletePreset(ctx, index));
        }
      } else {
        ctx.container.createDiv({
          cls: "cascade-dependent-hint",
          text: ctx.t("noPresets"),
        });
      }

      new Setting(ctx.container)
        .setName(ctx.t("presetSaveAs"))
        .setDesc(ctx.t("presetSaveAsDesc"))
        .addButton((btn) =>
          btn
            .setButtonText(ctx.t("presetSave"))
            .setCta()
            .onClick(() => this.savePreset(ctx)),
        );
    });
  }

  private getPresets(ctx: SectionContext): SettingsPreset[] {
    return ctx.settings.presets ?? [];
  }

  private async savePresets(ctx: SectionContext, presets: SettingsPreset[]): Promise<void> {
    ctx.settings.presets = presets;
    await ctx.save();
  }

  private savePreset(ctx: SectionContext): void {
    const name = window.prompt(ctx.t("presetNamePrompt"));
    if (!name?.trim()) return;

    const preset: SettingsPreset = {
      name: name.trim(),
      settings: this.extractPresetSettings(ctx.settings),
      createdAt: new Date().toISOString(),
    };

    const presets = [...this.getPresets(ctx), preset];
    void this.savePresets(ctx, presets);
    new Notice(ctx.t("presetSaved").replace("{name}", preset.name));
    ctx.refresh();
  }

  private loadPreset(ctx: SectionContext, preset: SettingsPreset): void {
    const merged = mergeSettings(preset.settings);
    Object.assign(ctx.settings, merged);
    void ctx.save().then(() => {
      new Notice(ctx.t("presetLoaded").replace("{name}", preset.name));
      ctx.refresh();
    });
  }

  private deletePreset(ctx: SectionContext, index: number): void {
    const presets = this.getPresets(ctx);
    const name = presets[index]?.name ?? "";
    presets.splice(index, 1);
    void this.savePresets(ctx, presets);
    new Notice(ctx.t("presetDeleted").replace("{name}", name));
    ctx.refresh();
  }

  private extractPresetSettings(settings: CascadeSettings): Partial<CascadeSettings> {
    const { presets: _presets, essentialStatuses: _essential, ...rest } = settings;
    void _presets;
    void _essential;
    return { ...rest };
  }

  /* ============================================
     IMPORT / EXPORT / RESET
     ============================================ */

  private renderImportExportReset(ctx: SectionContext): void {
    this.renderCard(ctx, "📦", ctx.t("settingsExport"), () => {
      new Setting(ctx.container)
        .setName(ctx.t("settingsExport"))
        .setDesc(ctx.t("settingsExportSuccess"))
        .addButton((btn) =>
          btn
            .setButtonText(ctx.t("settingsExport"))
            .setCta()
            .onClick(() => this.exportSettings(ctx)),
        );

      new Setting(ctx.container)
        .setName(ctx.t("settingsImport"))
        .addButton((btn) =>
          btn
            .setButtonText(ctx.t("settingsImport"))
            .onClick(() => this.importSettings(ctx)),
        );

      new Setting(ctx.container)
        .setName(ctx.t("settingsResetAll"))
        .addButton((btn) =>
          btn
            .setButtonText(ctx.t("settingsResetAll"))
            .setWarning()
            .onClick(() => this.resetAll(ctx)),
        );
    });
  }

  private exportSettings(ctx: SectionContext): void {
    const data = JSON.stringify(ctx.settings, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `cascade-settings-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    new Notice(ctx.t("settingsExportSuccess"));
  }

  private importSettings(ctx: SectionContext): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as Partial<CascadeSettings>;
        const merged = mergeSettings(data);
        Object.assign(ctx.settings, merged);
        await ctx.save();
        new Notice(ctx.t("settingsImportSuccess"));
        ctx.refresh();
      } catch {
        new Notice(ctx.t("settingsImportError"));
      }
    });
    input.click();
  }

  private resetAll(ctx: SectionContext): void {
    const defaults = mergeSettings(null);
    Object.assign(ctx.settings, defaults);
    void ctx.save().then(() => {
      ctx.refresh();
    });
  }

  /* ============================================
     SYNC INFO
     ============================================ */

  private renderSyncInfo(ctx: SectionContext): void {
    this.renderCard(ctx, "🔄", ctx.t("syncTitle"), () => {
      ctx.container.createDiv({
        cls: "cascade-dependent-hint",
        text: ctx.t("syncDesc"),
      });

      new Setting(ctx.container)
        .setName(ctx.t("syncExportForSync"))
        .setDesc(ctx.t("syncExportForSyncDesc"))
        .addButton((btn) =>
          btn
            .setButtonText(ctx.t("settingsExport"))
            .setCta()
            .onClick(() => this.exportSettings(ctx)),
        );

      new Setting(ctx.container)
        .setName(ctx.t("syncImportFromSync"))
        .setDesc(ctx.t("syncImportFromSyncDesc"))
        .addButton((btn) =>
          btn
            .setButtonText(ctx.t("settingsImport"))
            .onClick(() => this.importSettings(ctx)),
        );
    });
  }

  /* ============================================
     DOC LINKS
     ============================================ */

  private renderDocLinks(ctx: SectionContext): void {
    this.renderCard(ctx, "📖", ctx.t("docLinksTitle"), () => {
      const list = ctx.container.createDiv({ cls: "cascade-doc-links" });
      for (const [sectionId, url] of Object.entries(SECTION_DOCS)) {
        const link = list.createEl("a", {
          cls: "cascade-doc-link",
          text: ctx.t(`section${sectionId.charAt(0).toUpperCase() + sectionId.slice(1)}`) || sectionId,
          attr: { href: url, target: "_blank", rel: "noopener noreferrer" },
        });
        link.createSpan({ cls: "cascade-doc-link__arrow", text: " →" });
      }
    });
  }

  /* ============================================
     CARD HELPER
     ============================================ */

  private renderCard(ctx: SectionContext, icon: string, title: string, render: () => void): void {
    const card = ctx.container.createDiv({ cls: "cascade-card" });
    const header = card.createDiv({ cls: "cascade-card__header" });
    header.createSpan({ cls: "cascade-card__icon", text: icon });
    header.createSpan({ cls: "cascade-card__title", text: title });
    const body = card.createDiv({ cls: "cascade-card__body" });

    const prev = ctx.container;
    ctx.container = body;
    render();
    ctx.container = prev;
  }
}
