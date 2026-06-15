import { MarkdownView, Menu, type App, type EventRef } from "obsidian";
import { StatusService } from "./status-service";

interface CheckboxTarget {
  checkbox: HTMLElement;
  lineNumber: number;
  lineText: string;
  setStatus: (symbol: string) => void;
}

export class CheckboxMenu {
  private eventRef: EventRef | null = null;
  private overlay: HTMLElement | null = null;
  private readonly abort = new AbortController();

  constructor(
    private readonly app: App,
    private readonly statuses: StatusService,
  ) {}

  register(): void {
    document.addEventListener("contextmenu", this.handleContextMenu, { capture: true, signal: this.abort.signal });
    this.eventRef = this.app.workspace.on("editor-menu", (menu, _editor, view) => {
      if (!(view instanceof MarkdownView)) return;
      this.populateFallbackMenu(menu, view);
    });
  }

  unregister(): void {
    this.abort.abort();
    if (this.eventRef) this.app.workspace.offref(this.eventRef);
    this.closeOverlay();
  }

  private readonly handleContextMenu = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement) || !target.matches(".task-list-item-checkbox")) return;
    if (target.closest(".cascade-checkbox-menu-widget")) return;
    const checkbox = this.checkboxTarget(target);
    if (!checkbox) return;
    event.preventDefault();
    event.stopPropagation();
    this.showOverlay(checkbox);
  };

  private checkboxTarget(checkbox: HTMLElement): CheckboxTarget | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return null;
    const cm = (view.editor as unknown as { cm?: any })?.cm;
    if (!cm || typeof cm.posAtDOM !== "function") return null;
    const pos = cm.posAtDOM(checkbox);
    if (typeof pos !== "number" || pos < 0) return null;
    const line = cm.state.doc.lineAt(pos);
    if (!/^\s*(?:-|\d+\.)\s+\[[^\]]\]/.test(line.text)) return null;
    return {
      checkbox,
      lineNumber: line.number - 1,
      lineText: line.text,
      setStatus: (symbol: string) => {
        const current = view.editor.getLine(line.number - 1);
        view.editor.setLine(line.number - 1, current.replace(/^(\s*(?:-|\d+\.)\s+\[)[^\]](\])/, `$1${symbol}$2`));
      },
    };
  }

  private showOverlay(target: CheckboxTarget): void {
    this.closeOverlay();
    const overlay = document.body.createDiv({ cls: "cascade-checkbox-menu-widget" });
    const list = overlay.createEl("ul");
    for (const status of this.statuses.menuStatuses()) {
      const item = list.createEl("li", {
        cls: `cascade-checkbox-menu-widget__item${this.currentStatus(target.lineText) === status.symbol ? " is-active" : ""}`,
        attr: { "aria-label": status.label },
      });
      const input = item.createEl("input", { cls: "task-list-item-checkbox", attr: { type: "checkbox", "data-task": status.symbol } });
      if (status.symbol !== " ") input.checked = true;
      item.onclick = () => {
        target.setStatus(status.symbol);
        this.closeOverlay();
      };
    }
    this.overlay = overlay;
    this.positionOverlay(overlay, target.checkbox);
    window.setTimeout(() => document.addEventListener("mousedown", this.closeOnOutsideClick, { capture: true, signal: this.abort.signal }), 0);
  }

  private positionOverlay(overlay: HTMLElement, target: HTMLElement): void {
    const rect = target.getBoundingClientRect();
    const top = Math.min(window.innerHeight - overlay.offsetHeight - 8, rect.bottom + 6);
    const left = Math.min(window.innerWidth - overlay.offsetWidth - 8, Math.max(8, rect.left - 8));
    overlay.style.top = `${Math.max(8, top)}px`;
    overlay.style.left = `${left}px`;
  }

  private readonly closeOnOutsideClick = (event: MouseEvent): void => {
    if (this.overlay?.contains(event.target as Node)) return;
    this.closeOverlay();
  };

  private closeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
    document.removeEventListener("mousedown", this.closeOnOutsideClick, { capture: true });
  }

  private populateFallbackMenu(menu: Menu, view: MarkdownView): void {
    const editor = view.editor;
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    if (!/^\s*-\s+\[[^\]]\]/.test(line)) return;
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("Cascade checkbox").setIcon("check-square").setDisabled(true));
    for (const status of this.statuses.menuStatuses()) {
      menu.addItem((item) => {
        item
          .setTitle(status.label)
          .setChecked(this.currentStatus(line) === status.symbol)
          .onClick(() => editor.setLine(cursor.line, line.replace(/^(\s*-\s+\[)[^\]](\])/, `$1${status.symbol}$2`)));
      });
    }
  }

  private currentStatus(line: string): string {
    return line.match(/^\s*(?:-|\d+\.)\s+\[([^\]])\]/)?.[1] ?? "";
  }
}
