export class TFile {
  stat = { ctime: Date.now(), mtime: Date.now() };

  constructor(
    public path: string,
    public content = "",
  ) {}

  get extension(): string {
    return this.path.split(".").pop() ?? "";
  }

  get basename(): string {
    return this.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? this.path;
  }

  get parent(): { path: string } | null {
    const index = this.path.lastIndexOf("/");
    return index === -1 ? null : { path: this.path.slice(0, index) };
  }
}

export class TFolder {
  constructor(public path: string) {}
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "");
}

export class Notice {
  constructor(public message: string) {}
}

export class Menu {
  addSeparator(): void {}
  addItem(callback: (item: { setTitle(title: string): { onClick(callback: () => void): void } }) => void): void {
    callback({
      setTitle: () => ({
        onClick: () => undefined,
      }),
    });
  }
}

export class MarkdownView {}
export class ItemView {}
export class Modal {
  contentEl = { empty: () => {}, createEl: () => ({}), createDiv: () => ({}) };
  constructor(public app: unknown) {}
  open(): void {}
  close(): void {}
}
export function setIcon(): void {}
export class Plugin {}
export class PluginSettingTab {}
export class Setting {}
