import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import { CalendarService } from "./calendar-service";
import { sameDate } from "../notes/path-service";
import { NoteService } from "../notes/note-service";
import { ConfirmCreateModal } from "./confirm-modal";
import type { I18n } from "../i18n";
import type { CascadeSettings } from "../config/schema";

export const CASCADE_CALENDAR_VIEW = "cascade-calendar-view";

export class CalendarView extends ItemView {
  private cursor = new Date();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly notes: NoteService,
    private readonly calendar: CalendarService,
    private readonly i18n: I18n,
    private readonly settings: CascadeSettings,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return CASCADE_CALENDAR_VIEW;
  }

  getDisplayText(): string {
    return "Cascade";
  }

  getIcon(): string {
    return "calendar-days";
  }

  async onOpen(): Promise<void> {
    this.registerEvent(this.app.vault.on("create", () => this.scheduleRender()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleRender()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleRender()));
    this.render();
  }

  onClose(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    return Promise.resolve();
  }

  private scheduleRender(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.render(), 150);
  }

  private render(): void {
    const container = this.containerEl.children[1];
    container.empty();
    const root = container.createDiv({ cls: "cascade-calendar" });
    const toolbar = root.createDiv({ cls: "cascade-calendar__toolbar" });
    const title = toolbar.createDiv({ cls: "cascade-calendar__title" });
    const months = this.i18n.tArray("calendarMonths");
    title.createSpan({ cls: "cascade-calendar__month", text: months[this.cursor.getMonth()] });
    title.createSpan({ cls: "cascade-calendar__year", text: String(this.cursor.getFullYear()) });
    const controls = toolbar.createDiv({ cls: "cascade-calendar__controls" });
    const prev = controls.createEl("button", { cls: "cascade-calendar__nav", attr: { "aria-label": "Previous month" } });
    setIcon(prev, "chevron-left");
    const today = controls.createEl("button", { cls: "cascade-calendar__today", text: this.i18n.t("calendarToday") });
    const next = controls.createEl("button", { cls: "cascade-calendar__nav", attr: { "aria-label": "Next month" } });
    setIcon(next, "chevron-right");
    prev.onclick = () => {
      this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() - 1, 1);
      this.render();
    };
    next.onclick = () => {
      this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + 1, 1);
      this.render();
    };
    today.onclick = () => {
      this.cursor = new Date();
      this.render();
    };

    const showWeekNumbers = this.settings.calendarShowWeekNumber;
    const weekdays = root.createDiv({ cls: `cascade-calendar__header${showWeekNumbers ? " show-week-numbers" : ""}` });
    if (showWeekNumbers) {
      weekdays.createDiv({ cls: "cascade-calendar__weekday", text: "WK" });
    }
    for (const label of this.i18n.tArray("calendarWeekdays")) {
      weekdays.createDiv({ cls: "cascade-calendar__weekday", text: label });
    }

    const grid = root.createDiv({ cls: `cascade-calendar__grid${showWeekNumbers ? " show-week-numbers" : ""}` });
    const todayDate = new Date();
    const ariaHas = this.i18n.t("calendarAriaHasDaily");
    const ariaNo = this.i18n.t("calendarAriaNoDaily");
    let lastWeek = -1;
    for (const date of this.calendar.monthGrid(this.cursor)) {
      if (showWeekNumbers) {
        const wk = this.calendar.getWeekNumber(date);
        if (wk !== lastWeek) {
          grid.createDiv({ cls: "cascade-calendar__week-number", text: String(wk) });
          lastWeek = wk;
        } else {
          grid.createDiv();
        }
      }
      const inMonth = date.getMonth() === this.cursor.getMonth();
      const hasDaily = this.calendar.hasDaily(date);
      const day = grid.createEl("button", {
        cls: `cascade-calendar__day${sameDate(date, todayDate) ? " is-today" : ""}${inMonth ? "" : " is-outside"}${hasDaily ? " has-daily" : ""}`,
        attr: { "aria-label": hasDaily ? ariaHas : ariaNo },
      });
      day.createSpan({ cls: "cascade-calendar__number", text: String(date.getDate()) });
      if (hasDaily) day.createSpan({ cls: "cascade-calendar__dot" });
      day.onclick = async () => {
        if (!hasDaily && this.settings.calendarConfirmCreate) {
          new ConfirmCreateModal(this.app, this.i18n, async () => {
            await this.notes.openDate(date, this.settings.calendarOpenInNewLeaf);
            this.render();
          }).open();
        } else {
          await this.notes.openDate(date, this.settings.calendarOpenInNewLeaf);
          this.render();
        }
      };
    }
  }
}
