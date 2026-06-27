import { Setting } from "obsidian";
import type { SectionContext, SettingsSection } from "../settings-section";
import { SettingBuilder } from "../setting-builder";

export class GeneralSection implements SettingsSection {
  readonly id = "general";
  readonly icon = "⚙️";
  readonly labelKey = "sectionGeneral";

  render(ctx: SectionContext): void {
    this.renderGeneral(ctx);
    this.renderFeatures(ctx);
  }

  private renderGeneral(ctx: SectionContext): void {
    this.renderCard(ctx, "⚙️", ctx.t("sectionGeneral"), () => {
      new SettingBuilder(ctx)
        .name(ctx.t("language"))
        .tooltip(ctx.t("tooltipLanguage"))
        .refresh()
        .dropdown("language", [
          ["auto", ctx.t("auto")],
          ["pt-BR", "pt-BR"],
          ["en-US", "en-US"],
        ]);

      new SettingBuilder(ctx)
        .name(ctx.t("startCascadeOnStartup"))
        .tooltip(ctx.t("tooltipStartOnStartup"))
        .toggle("startCascadeOnStartup");

      if (!ctx.settings.startCascadeOnStartup) {
        new Setting(ctx.container)
          .setName(ctx.t("manualStart"))
          .setDesc(ctx.t("manualStartDesc"))
          .addButton((b) =>
            b.setButtonText(ctx.t("startCascadeButton")).onClick(() => {
              // @ts-ignore
              ctx.app.commands.executeCommandById("obsidian-cascade:start-cascade");
            }),
          );
      }

      this.renderStartupDelay(ctx);
    });
  }

  private renderStartupDelay(ctx: SectionContext): void {
    const delayOptions: [string, string][] = [
      ["0", ctx.t("delay0s")],
      ["5", ctx.t("delay5s")],
      ["10", ctx.t("delay10s")],
      ["30", ctx.t("delay30s")],
      ["custom", ctx.t("delayCustom")],
    ];

    new SettingBuilder(ctx)
      .name(ctx.t("startupDelay"))
      .tooltip(ctx.t("tooltipStartupDelay"))
      .refresh()
      .dropdown("startupDelayMode", delayOptions);

    if (ctx.settings.startupDelayMode === "custom") {
      new SettingBuilder(ctx)
        .name(ctx.t("startupDelayCustom"))
        .tooltip(ctx.t("tooltipStartupDelayCustom"))
        .validate((v) => (v && Number(v) < 0 ? ctx.t("errorPositiveNumber") : null))
        .text("startupDelayCustomSeconds", ctx.t("secondsPlaceholder"));
    }
  }

  private renderFeatures(ctx: SectionContext): void {
    this.renderCard(ctx, "🎛️", ctx.t("sectionFeatures"), () => {
      new SettingBuilder(ctx)
        .name(ctx.t("agendaEnabled"))
        .tooltip(ctx.t("tooltipAgendaEnabled"))
        .refresh()
        .toggle("agendaEnabled");

      new SettingBuilder(ctx)
        .name(ctx.t("checkboxEnabled"))
        .tooltip(ctx.t("tooltipCheckboxEnabled"))
        .refresh()
        .toggle("checkboxEnabled");

      new SettingBuilder(ctx)
        .name(ctx.t("calendarEnabled"))
        .tooltip(ctx.t("tooltipCalendarEnabled"))
        .refresh()
        .toggle("calendarEnabled");

      new SettingBuilder(ctx)
        .name(ctx.t("normalizerEnabled"))
        .tooltip(ctx.t("tooltipNormalizerEnabled"))
        .refresh()
        .toggle("normalizerEnabled");

      new SettingBuilder(ctx)
        .name(ctx.t("migrationEnabled"))
        .tooltip(ctx.t("tooltipMigrationEnabled"))
        .refresh()
        .toggle("migrationEnabled");

      new SettingBuilder(ctx)
        .name(ctx.t("frontmatterEnabled"))
        .tooltip(ctx.t("tooltipFrontmatterEnabled"))
        .refresh()
        .toggle("frontmatterEnabled");

      new SettingBuilder(ctx)
        .name(ctx.t("loggingEnabled"))
        .tooltip(ctx.t("tooltipLoggingEnabled"))
        .refresh()
        .toggle("loggingEnabled");
    });
  }

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
