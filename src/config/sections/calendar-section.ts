import { Setting } from "obsidian";
import type { SectionContext, SettingsSection } from "../settings-section";
import { SettingBuilder } from "../setting-builder";

export class CalendarSection implements SettingsSection {
  readonly id = "calendar";
  readonly icon = "📆";
  readonly labelKey = "sectionCalendar";

  render(ctx: SectionContext): void {
    this.renderCard(ctx, "📆", ctx.t("sectionCalendar"), () => {
      new Setting(ctx.container)
        .setName(ctx.t("calendarRibbonButton"))
        .setDesc(ctx.t("tooltipCalendarRibbonButton"))
        .addToggle((t) =>
          t.setValue(ctx.settings.calendarShowRibbonButton).onChange(async (value) => {
            ctx.settings.calendarShowRibbonButton = value;
            await ctx.save();
            ctx.plugin.updateCalendarRibbon();
          }),
        );

      new Setting(ctx.container)
        .setName(ctx.t("calendarFirstDayOfWeek"))
        .setDesc(ctx.t("tooltipCalendarFirstDay"))
        .addDropdown((d) =>
          d
            .addOption("0", ctx.t("calendarWeekdays").split(",")[0])
            .addOption("1", ctx.t("calendarWeekdays").split(",")[1])
            .setValue(String(ctx.settings.calendarFirstDayOfWeek))
            .onChange(async (v) => {
              ctx.settings.calendarFirstDayOfWeek = Number(v) as 0 | 1;
              await ctx.save();
            }),
        );

      new SettingBuilder(ctx)
        .name(ctx.t("calendarShowWeekNumber"))
        .tooltip(ctx.t("tooltipCalendarWeekNumber"))
        .toggle("calendarShowWeekNumber");

      new SettingBuilder(ctx)
        .name(ctx.t("calendarOpenInNewLeaf"))
        .tooltip(ctx.t("tooltipCalendarOpenNew"))
        .toggle("calendarOpenInNewLeaf");

      new SettingBuilder(ctx)
        .name(ctx.t("calendarConfirmCreateLabel"))
        .tooltip(ctx.t("tooltipCalendarConfirm"))
        .toggle("calendarConfirmCreate");
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
