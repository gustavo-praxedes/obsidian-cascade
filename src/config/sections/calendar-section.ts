import type { SectionContext, SettingsSection } from "../settings-section";
import { SettingBuilder } from "../setting-builder";

export class CalendarSection implements SettingsSection {
  readonly id = "calendar";
  readonly icon = "📆";
  readonly labelKey = "sectionCalendar";

  render(ctx: SectionContext): void {
    this.renderCard(ctx, "📆", ctx.t("sectionCalendar"), () => {
      new SettingBuilder(ctx)
        .name(ctx.t("calendarRibbonButton"))
        .tooltip(ctx.t("tooltipCalendarRibbonButton"))
        .refresh()
        .toggle("calendarShowRibbonButton");

      new SettingBuilder(ctx)
        .name(ctx.t("calendarFirstDayOfWeek"))
        .tooltip(ctx.t("tooltipCalendarFirstDay"))
        .refresh()
        .dropdown("calendarFirstDayOfWeek", [
          ["0", ctx.t("sunday")],
          ["1", ctx.t("monday")],
          ["2", ctx.t("tuesday")],
          ["3", ctx.t("wednesday")],
          ["4", ctx.t("thursday")],
          ["5", ctx.t("friday")],
          ["6", ctx.t("saturday")],
        ]);

      new SettingBuilder(ctx)
        .name(ctx.t("calendarShowWeekNumber"))
        .tooltip(ctx.t("tooltipCalendarWeekNumber"))
        .refresh()
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
