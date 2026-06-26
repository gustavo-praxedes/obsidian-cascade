import type { SectionContext, SettingsSection } from "../settings-section";
import { SettingBuilder } from "../setting-builder";
import { PathService } from "../../notes/path-service";

export class AgendaSection implements SettingsSection {
  readonly id = "agenda";
  readonly icon = "📅";
  readonly labelKey = "sectionAgenda";

  render(ctx: SectionContext): void {
    const paths = new PathService(ctx.settings);
    const renderPreview = (format: string): string => {
      try {
        const info = paths.dateInfo(new Date());
        return format
          .replaceAll("DDD", info.weekdayName)
          .replaceAll("MMM", info.monthName)
          .replaceAll("YYYY", info.yyyy)
          .replaceAll("MM", info.mm)
          .replaceAll("mm", info.mm)
          .replaceAll("DD", info.dd)
          .replaceAll("dd", info.dd)
          .replaceAll("WW", String(info.week).padStart(2, "0"))
          .replace(/\[([^\]]+)\]/g, "$1");
      } catch {
        return "—";
      }
    };

    this.renderCard(ctx, "📅", ctx.t("sectionAgenda"), () => {
      new SettingBuilder(ctx)
        .name(ctx.t("agendaRoot"))
        .tooltip(ctx.t("tooltipAgendaRoot"))
        .text("agendaRoot");
    });

    this.renderPeriodCard(ctx, "📆", ctx.t("sectionAnnual"), ctx.settings.yearlyEnabled, () => {
      new SettingBuilder(ctx)
        .name(ctx.t("yearlyFormat"))
        .tooltip(ctx.t("tooltipYearlyFormat"))
        .textWithPreview("yearlyFormat", renderPreview);
      new SettingBuilder(ctx)
        .name(ctx.t("yearlyTemplate"))
        .tooltip(ctx.t("tooltipYearlyTemplate"))
        .text("yearlyTemplate");
      new SettingBuilder(ctx)
        .name(ctx.t("yearlyFolder"))
        .tooltip(ctx.t("tooltipYearlyFolder"))
        .textWithPreview("yearlyFolder", (v) => v || "—");
    });

    this.renderPeriodCard(ctx, "📅", ctx.t("sectionMonthly"), ctx.settings.monthlyEnabled, () => {
      new SettingBuilder(ctx)
        .name(ctx.t("monthlyFormat"))
        .tooltip(ctx.t("tooltipMonthlyFormat"))
        .textWithPreview("monthlyFormat", renderPreview);
      new SettingBuilder(ctx)
        .name(ctx.t("monthlyTemplate"))
        .tooltip(ctx.t("tooltipMonthlyTemplate"))
        .text("monthlyTemplate");
      new SettingBuilder(ctx)
        .name(ctx.t("monthlyFolder"))
        .tooltip(ctx.t("tooltipMonthlyFolder"))
        .textWithPreview("monthlyFolder", (v) => v || "—");
    });

    this.renderPeriodCard(ctx, "📋", ctx.t("sectionWeekly"), ctx.settings.weeklyEnabled, () => {
      new SettingBuilder(ctx)
        .name(ctx.t("weeklyFormat"))
        .tooltip(ctx.t("tooltipWeeklyFormat"))
        .textWithPreview("weeklyFormat", renderPreview);
      new SettingBuilder(ctx)
        .name(ctx.t("weeklyTemplate"))
        .tooltip(ctx.t("tooltipWeeklyTemplate"))
        .text("weeklyTemplate");
      new SettingBuilder(ctx)
        .name(ctx.t("weeklyFolder"))
        .tooltip(ctx.t("tooltipWeeklyFolder"))
        .textWithPreview("weeklyFolder", (v) => v || "—");
    });

    this.renderCard(ctx, "📝", ctx.t("sectionDaily"), () => {
      new SettingBuilder(ctx)
        .name(ctx.t("dailyFormat"))
        .tooltip(ctx.t("tooltipDailyFormat"))
        .textWithPreview("dailyFormat", renderPreview);

      new SettingBuilder(ctx)
        .name(ctx.t("dailyTemplate"))
        .tooltip(ctx.t("tooltipDailyTemplate"))
        .text("dailyTemplate");

      new SettingBuilder(ctx)
        .name(ctx.t("dailyFolder"))
        .tooltip(ctx.t("tooltipDailyFolder"))
        .textWithPreview("dailyFolder", (v) => v || "—");
    });
  }

  private renderPeriodCard(
    ctx: SectionContext,
    icon: string,
    title: string,
    enabled: boolean,
    renderContent: () => void,
  ): void {
    const card = ctx.container.createDiv({ cls: "cascade-card" });
    const header = card.createDiv({ cls: "cascade-card__header" });
    header.createSpan({ cls: "cascade-card__icon", text: icon });
    header.createSpan({ cls: "cascade-card__title", text: title });
    const body = card.createDiv({ cls: "cascade-card__body" });

    if (enabled) {
      const prev = ctx.container;
      ctx.container = body;
      renderContent();
      ctx.container = prev;
    } else {
      body.createDiv({
        cls: "cascade-dependent-hint",
        text: ctx.t("dependentHintEnable").replace("{section}", title.toLowerCase()),
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
