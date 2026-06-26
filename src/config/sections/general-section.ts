import { Setting } from "obsidian";
import type { SectionContext, SettingsSection } from "../settings-section";
import { SettingBuilder } from "../setting-builder";

export class GeneralSection implements SettingsSection {
  readonly id = "general";
  readonly icon = "⚙️";
  readonly labelKey = "sectionGeneral";

  render(ctx: SectionContext): void {
    this.renderGeneral(ctx);
    this.renderAgendaOverview(ctx);
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

  private renderAgendaOverview(ctx: SectionContext): void {
    this.renderCard(ctx, "📅", ctx.t("sectionAgenda"), () => {
      this.renderOpenOnStartupCards(ctx);

      new SettingBuilder(ctx)
        .name(ctx.t("agendaRoot"))
        .tooltip(ctx.t("tooltipAgendaRoot"))
        .text("agendaRoot");

      new SettingBuilder(ctx)
        .name(ctx.t("yearlyEnabled"))
        .tooltip(ctx.t("tooltipYearlyEnabled"))
        .toggle("yearlyEnabled");

      new SettingBuilder(ctx)
        .name(ctx.t("monthlyEnabled"))
        .tooltip(ctx.t("tooltipMonthlyEnabled"))
        .toggle("monthlyEnabled");
    });
  }

  private renderFeatures(ctx: SectionContext): void {
    this.renderCard(ctx, "🎛️", ctx.t("sectionFeatures"), () => {
      new SettingBuilder(ctx)
        .name(ctx.t("weeklyEnabled"))
        .tooltip(ctx.t("tooltipWeeklyEnabled"))
        .toggle("weeklyEnabled");

      new SettingBuilder(ctx)
        .name(ctx.t("normalizerEnabled"))
        .tooltip(ctx.t("tooltipNormalizerEnabled"))
        .toggle("normalizerEnabled");

      new SettingBuilder(ctx)
        .name(ctx.t("migrationEnabled"))
        .tooltip(ctx.t("tooltipMigrationEnabled"))
        .toggle("migrationEnabled");

      new SettingBuilder(ctx)
        .name(ctx.t("frontmatterEnabled"))
        .tooltip(ctx.t("tooltipFrontmatterEnabled"))
        .toggle("frontmatterEnabled");

      new SettingBuilder(ctx)
        .name(ctx.t("loggingEnabled"))
        .tooltip(ctx.t("tooltipLoggingEnabled"))
        .toggle("loggingEnabled");
    });
  }

  private renderOpenOnStartupCards(ctx: SectionContext): void {
    const setting = new Setting(ctx.container).setName(ctx.t("openOnStartup"));

    const keys = [
      "none",
      "openAnnualOnStartup",
      "openMonthlyOnStartup",
      "openWeeklyOnStartup",
      "openDailyOnStartup",
    ] as const;

    const labels: Record<string, string> = {
      none: ctx.t("none"),
      openAnnualOnStartup: ctx.t("sectionAnnual"),
      openMonthlyOnStartup: ctx.t("sectionMonthly"),
      openWeeklyOnStartup: ctx.t("sectionWeekly"),
      openDailyOnStartup: ctx.t("sectionDaily"),
    };

    const icons: Record<string, string> = {
      none: "—",
      openAnnualOnStartup: "📆",
      openMonthlyOnStartup: "📅",
      openWeeklyOnStartup: "📋",
      openDailyOnStartup: "📝",
    };

    const activeKey =
      (["openAnnualOnStartup", "openMonthlyOnStartup", "openWeeklyOnStartup", "openDailyOnStartup"] as const)
        .find((k) => ctx.settings[k])
        ?? "none";

    const container = setting.controlEl.createDiv({ cls: "cascade-radio-cards" });

    for (const key of keys) {
      const isSelected = key === activeKey;
      const card = container.createDiv({
        cls: `cascade-radio-card${isSelected ? " is-selected" : ""}`,
      });
      card.createSpan({ cls: "cascade-radio-card__icon", text: icons[key] });
      card.createSpan({ text: labels[key] });

      card.addEventListener("click", async () => {
        ctx.settings.openAnnualOnStartup = false;
        ctx.settings.openMonthlyOnStartup = false;
        ctx.settings.openWeeklyOnStartup = false;
        ctx.settings.openDailyOnStartup = false;
        if (key !== "none") {
          (ctx.settings as any)[key] = true;
        }
        await ctx.save();
        ctx.refresh();
      });
    }
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
