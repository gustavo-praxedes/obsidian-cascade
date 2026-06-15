import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import { CalendarService } from "./calendar-service";
import { sameDate } from "../notes/path-service";
import { NoteService } from "../notes/note-service";

export const CASCADE_CALENDAR_VIEW = "cascade-calendar-view";

export class CalendarView extends ItemView {
  private cursor = new Date();

  constructor(
    leaf: WorkspaceLeaf,
    private readonly notes: NoteService,
    private readonly calendar: CalendarService,
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
    this.registerEvent(this.app.vault.on("create", () => this.render()));
    this.registerEvent(this.app.vault.on("delete", () => this.render()));
    this.registerEvent(this.app.vault.on("rename", () => this.render()));
    this.render();
  }

  private render(): void {
    const container = this.containerEl.children[1];
    container.empty();
    const root = container.createDiv({ cls: "cascade-calendar" });
    const toolbar = root.createDiv({ cls: "cascade-calendar__toolbar" });
    const title = toolbar.createDiv({ cls: "cascade-calendar__title" });
    title.createSpan({ cls: "cascade-calendar__month", text: capitalize(this.cursor.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")) });
    title.createSpan({ cls: "cascade-calendar__year", text: String(this.cursor.getFullYear()) });
    const controls = toolbar.createDiv({ cls: "cascade-calendar__controls" });
    const prev = controls.createEl("button", { cls: "cascade-calendar__nav", attr: { "aria-label": "Previous month" } });
    setIcon(prev, "chevron-left");
    const today = controls.createEl("button", { cls: "cascade-calendar__today", text: "HOJE" });
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

    const weekdays = root.createDiv({ cls: "cascade-calendar__header" });
    for (const label of ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"]) {
      weekdays.createDiv({ cls: "cascade-calendar__weekday", text: label });
    }

    const grid = root.createDiv({ cls: "cascade-calendar__grid" });
    for (const date of this.calendar.monthGrid(this.cursor)) {
      const inMonth = date.getMonth() === this.cursor.getMonth();
      const hasDaily = this.calendar.hasDaily(date);
      const day = grid.createEl("button", {
        cls: `cascade-calendar__day${sameDate(date, new Date()) ? " is-today" : ""}${inMonth ? "" : " is-outside"}${hasDaily ? " has-daily" : ""}`,
        attr: { "aria-label": hasDaily ? "Nota diaria existente" : "Criar nota diaria" },
      });
      day.createSpan({ cls: "cascade-calendar__number", text: String(date.getDate()) });
      if (hasDaily) day.createSpan({ cls: "cascade-calendar__dot" });
      day.onclick = async () => {
        await this.notes.openDate(date);
        this.render();
      };
    }
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("pt-BR") + value.slice(1);
}
