import { ItemView, setIcon, type WorkspaceLeaf } from "obsidian";
import { sameDate } from "../notes/path-service";
import { NoteService } from "../notes/note-service";

export const CASCADE_CALENDAR_VIEW = "cascade-calendar-view";

export class CalendarView extends ItemView {
  private cursor = new Date();

  constructor(
    leaf: WorkspaceLeaf,
    private readonly notes: NoteService,
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
    this.render();
  }

  private render(): void {
    const container = this.containerEl.children[1];
    container.empty();
    const root = container.createDiv({ cls: "cascade-calendar" });
    const toolbar = root.createDiv({ cls: "cascade-calendar__toolbar" });
    const prev = toolbar.createEl("button", { attr: { "aria-label": "Previous month" } });
    setIcon(prev, "chevron-left");
    toolbar.createEl("strong", { text: this.cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }) });
    const next = toolbar.createEl("button", { attr: { "aria-label": "Next month" } });
    setIcon(next, "chevron-right");
    prev.onclick = () => {
      this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() - 1, 1);
      this.render();
    };
    next.onclick = () => {
      this.cursor = new Date(this.cursor.getFullYear(), this.cursor.getMonth() + 1, 1);
      this.render();
    };

    const weekdays = root.createDiv({ cls: "cascade-calendar__header" });
    for (const label of ["D", "S", "T", "Q", "Q", "S", "S"]) {
      weekdays.createDiv({ cls: "cascade-calendar__weekday", text: label });
    }

    const grid = root.createDiv({ cls: "cascade-calendar__grid" });
    const first = new Date(this.cursor.getFullYear(), this.cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const day = grid.createEl("button", {
        cls: `cascade-calendar__day${sameDate(date, new Date()) ? " is-today" : ""}`,
        text: String(date.getDate()),
      });
      day.onclick = () => void this.notes.openDate(date);
    }
  }
}
