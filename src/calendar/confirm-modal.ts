import { App, Modal } from "obsidian";
import type { I18n } from "../i18n";

export class ConfirmCreateModal extends Modal {
  constructor(
    app: App,
    private readonly i18n: I18n,
    private readonly onConfirm: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.contentEl.createEl("p", { text: this.i18n.t("calendarConfirmCreate") });
    const btns = this.contentEl.createDiv({ cls: "modal-button-container" });
    btns.createEl("button", { text: "OK", cls: "mod-cta" }).onclick = () => {
      this.close();
      this.onConfirm();
    };
    btns.createEl("button", { text: this.i18n.t("calendarToday") }).onclick = () => {
      this.close();
    };
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
