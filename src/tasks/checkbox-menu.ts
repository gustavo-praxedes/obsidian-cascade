import { MarkdownView, Menu, type App, type EventRef } from "obsidian";
import { StatusService } from "./status-service";

export class CheckboxMenu {
  private eventRef: EventRef | null = null;

  constructor(
    private readonly app: App,
    private readonly statuses: StatusService,
  ) {}

  register(): void {
    this.eventRef = this.app.workspace.on("editor-menu", (menu, _editor, view) => {
      if (!(view instanceof MarkdownView)) return;
      this.populateMenu(menu, view);
    });
  }

  unregister(): void {
    if (this.eventRef) this.app.workspace.offref(this.eventRef);
  }

  private populateMenu(menu: Menu, view: MarkdownView): void {
    const editor = view.editor;
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    if (!/^\s*-\s+\[[^\]]\]/.test(line)) return;
    menu.addSeparator();
    for (const status of this.statuses.all()) {
      menu.addItem((item) => {
        item
          .setTitle(`${status.icon ?? status.symbol} ${status.label}`)
          .onClick(() => editor.setLine(cursor.line, line.replace(/^(\s*-\s+\[)[^\]](\])/, `$1${status.symbol}$2`)));
      });
    }
  }
}
