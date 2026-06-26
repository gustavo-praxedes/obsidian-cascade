import { Setting } from "obsidian";
import type { CascadeSettings } from "./schema";
import type { SectionContext } from "./settings-section";

export class SettingBuilder {
  private ctx: SectionContext;
  private _name = "";
  private _desc = "";
  private _tooltip = "";
  private _refreshOnSave = false;

  constructor(ctx: SectionContext) {
    this.ctx = ctx;
  }

  name(n: string): this {
    this._name = n;
    return this;
  }

  desc(d: string): this {
    this._desc = d;
    return this;
  }

  tooltip(t: string): this {
    this._tooltip = t;
    return this;
  }

  refresh(r = true): this {
    this._refreshOnSave = r;
    return this;
  }

  toggle(key: keyof CascadeSettings): Setting {
    const s = this.buildBase();
    s.addToggle((t) =>
      t
        .setValue(this.ctx.settings[key] as boolean)
        .onChange(async (v) => {
          (this.ctx.settings as any)[key] = v;
          await this.finish();
        }),
    );
    return s;
  }

  text(key: keyof CascadeSettings, placeholder?: string): Setting {
    const s = this.buildBase();
    s.addText((t) => {
      t.setValue(String(this.ctx.settings[key] ?? ""));
      if (placeholder) t.setPlaceholder(placeholder);
      t.onChange(async (v) => {
        (this.ctx.settings as any)[key] = v.trim();
        await this.finish();
      });
    });
    return s;
  }

  textWithPreview(
    key: keyof CascadeSettings,
    renderPreview: (value: string) => string,
    placeholder?: string,
  ): Setting {
    const s = this.buildBase();
    const previewEl = s.descEl.createDiv({ cls: "cascade-format-preview" });
    previewEl.createSpan({ cls: "cascade-format-preview__label", text: "→ " });
    const valueSpan = previewEl.createSpan({ cls: "cascade-format-preview__value" });

    const updatePreview = (val: string): void => {
      valueSpan.textContent = renderPreview(val);
    };
    updatePreview(String(this.ctx.settings[key] ?? ""));

    s.addText((t) => {
      t.setValue(String(this.ctx.settings[key] ?? ""));
      if (placeholder) t.setPlaceholder(placeholder);
      t.onChange(async (v) => {
        (this.ctx.settings as any)[key] = v.trim();
        updatePreview(v.trim());
        await this.finish();
      });
    });
    return s;
  }

  textarea(key: keyof CascadeSettings): Setting {
    const s = this.buildBase();
    s.addTextArea((t) =>
      t
        .setValue((this.ctx.settings[key] as string[]).join("\n"))
        .onChange(async (v) => {
          (this.ctx.settings as any)[key] = v
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
          await this.finish();
        }),
    );
    return s;
  }

  dropdown(key: keyof CascadeSettings, options: [string, string][]): Setting {
    const s = this.buildBase();
    s.addDropdown((d) => {
      for (const [val, label] of options) {
        d.addOption(val, label);
      }
      d.setValue(String(this.ctx.settings[key]));
      d.onChange(async (v) => {
        (this.ctx.settings as any)[key] = v;
        await this.finish();
      });
    });
    return s;
  }

  textCustom(
    getValue: () => string,
    setValue: (v: string) => void,
    placeholder?: string,
  ): Setting {
    const s = this.buildBase();
    s.addText((t) => {
      t.setValue(getValue());
      if (placeholder) t.setPlaceholder(placeholder);
      t.onChange(async (v) => {
        setValue(v.trim());
        await this.finish();
      });
    });
    return s;
  }

  textCustomWithPreview(
    getValue: () => string,
    setValue: (v: string) => void,
    renderPreview: (value: string) => string,
    placeholder?: string,
  ): Setting {
    const s = this.buildBase();
    const previewEl = s.descEl.createDiv({ cls: "cascade-format-preview" });
    previewEl.createSpan({ cls: "cascade-format-preview__label", text: "→ " });
    const valueSpan = previewEl.createSpan({ cls: "cascade-format-preview__value" });

    const updatePreview = (val: string): void => {
      valueSpan.textContent = renderPreview(val);
    };
    updatePreview(getValue());

    s.addText((t) => {
      t.setValue(getValue());
      if (placeholder) t.setPlaceholder(placeholder);
      t.onChange(async (v) => {
        setValue(v.trim());
        updatePreview(v.trim());
        await this.finish();
      });
    });
    return s;
  }

  dropdownCustom(
    getValue: () => string,
    options: [string, string][],
    onChange?: (v: string) => void,
  ): Setting {
    const s = this.buildBase();
    s.addDropdown((d) => {
      for (const [val, label] of options) {
        d.addOption(val, label);
      }
      d.setValue(getValue());
      d.onChange(async (v) => {
        onChange?.(v);
        await this.finish();
      });
    });
    return s;
  }

  validate(validator: (value: string) => string | null): this {
    const base = this.buildBase();
    let errorEl: HTMLElement | null = null;

    const control = base.controlEl;
    const input = control.querySelector("input, textarea") as HTMLInputElement | HTMLTextAreaElement | null;
    if (input) {
      input.addEventListener("input", () => {
        const error = validator(input.value);
        if (error) {
          if (!errorEl) {
            errorEl = base.settingEl.createDiv({ cls: "cascade-field-error" });
            base.settingEl.addClass("cascade-setting-item--error");
          }
          errorEl.textContent = error;
        } else if (errorEl) {
          errorEl.remove();
          errorEl = null;
          base.settingEl.removeClass("cascade-setting-item--error");
        }
      });
    }
    return this;
  }

  button(label: string, cta: boolean, onClick: () => void): Setting {
    const s = this.buildBase();
    s.addButton((b) => {
      b.setButtonText(label);
      if (cta) b.setCta();
      b.onClick(onClick);
    });
    return s;
  }

  warningButton(label: string, onClick: () => void): Setting {
    const s = this.buildBase();
    s.addButton((b) => {
      b.setButtonText(label).setWarning();
      b.onClick(onClick);
    });
    return s;
  }

  browseFolder(onSelect: (path: string) => void): Setting {
    const s = this.buildBase();
    s.addButton((b) => {
      b.setButtonText("📁").setTooltip("Browse folder");
      b.onClick(async () => {
        const modal = new FolderSuggestModal(this.ctx.app, onSelect);
        modal.open();
      });
    });
    return s;
  }

  browseFile(onSelect: (path: string) => void): Setting {
    const s = this.buildBase();
    s.addButton((b) => {
      b.setButtonText("📁").setTooltip("Browse file");
      b.onClick(async () => {
        const modal = new FileSuggestModal(this.ctx.app, onSelect);
        modal.open();
      });
    });
    return s;
  }

  private buildBase(): Setting {
    const s = new Setting(this.ctx.container).setName(this._name);
    if (this._desc) s.setDesc(this._desc);
    if (this._tooltip) {
      const tip = s.nameEl.createSpan({ cls: "cascade-tooltip", text: "?" });
      tip.createSpan({ cls: "cascade-tooltip__content", text: this._tooltip });
    }
    return s;
  }

  private async finish(): Promise<void> {
    await this.ctx.save();
    if (this._refreshOnSave) this.ctx.refresh();
  }
}

/* ============================================
   MODALS
   ============================================ */

import { App, FuzzySuggestModal, TFolder, TFile } from "obsidian";

class FolderSuggestModal extends FuzzySuggestModal<TFolder> {
  private onSelect: (path: string) => void;

  constructor(app: App, onSelect: (path: string) => void) {
    super(app);
    this.onSelect = onSelect;
    this.setPlaceholder("Select folder...");
  }

  getItems(): TFolder[] {
    const folders: TFolder[] = [];
    this.app.vault.getRoot().children.forEach((child) => {
      if (child instanceof TFolder) {
        this.collectFolders(child, folders);
      }
    });
    return folders;
  }

  private collectFolders(folder: TFolder, result: TFolder[]): void {
    result.push(folder);
    folder.children.forEach((child) => {
      if (child instanceof TFolder) {
        this.collectFolders(child, result);
      }
    });
  }

  getItemText(item: TFolder): string {
    return item.path;
  }

  onChooseItem(item: TFolder): void {
    this.onSelect(item.path);
  }
}

class FileSuggestModal extends FuzzySuggestModal<TFile> {
  private onSelect: (path: string) => void;

  constructor(app: App, onSelect: (path: string) => void) {
    super(app);
    this.onSelect = onSelect;
    this.setPlaceholder("Select file...");
  }

  getItems(): TFile[] {
    return this.app.vault.getFiles().filter((f) => f.extension === "md");
  }

  getItemText(item: TFile): string {
    return item.path;
  }

  onChooseItem(item: TFile): void {
    this.onSelect(item.path);
  }
}
