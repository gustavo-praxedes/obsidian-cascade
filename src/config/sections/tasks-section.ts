import { Setting } from "obsidian";
import type { SectionContext, SettingsSection } from "../settings-section";
import { SettingBuilder } from "../setting-builder";

export class TasksSection implements SettingsSection {
  readonly id = "tasks";
  readonly icon = "✅";
  readonly labelKey = "sectionTasks";

  render(ctx: SectionContext): void {
    this.renderCard(ctx, "✅", ctx.t("sectionTasks"), () => {
      if (ctx.settings.migrationEnabled) {
        new SettingBuilder(ctx)
          .name(ctx.t("runMigrationOnStartup"))
          .tooltip(ctx.t("tooltipRunMigrationOnStartup"))
          .toggle("runMigrationOnStartup");

        const recurring = new SettingBuilder(ctx)
          .name(ctx.t("recurringTasksPathLabel"))
          .tooltip(ctx.t("tooltipRecurringTasksPath"))
          .text("recurringTasksPath");

        recurring.addButton((b) => {
          b.setButtonText("📁").setTooltip("Browse file");
          b.onClick(() => {
            const modal = new FileSuggestModal(ctx.app, (path) => {
              ctx.settings.recurringTasksPath = path;
              void ctx.save();
              ctx.refresh();
            });
            modal.open();
          });
        });

        new SettingBuilder(ctx)
          .name(ctx.t("taskSetCreatedDate"))
          .tooltip(ctx.t("tooltipTaskSetCreated"))
          .toggle("taskSetCreatedDate");

        new SettingBuilder(ctx)
          .name(ctx.t("taskSetDoneDate"))
          .tooltip(ctx.t("tooltipTaskSetDone"))
          .toggle("taskSetDoneDate");

        new SettingBuilder(ctx)
          .name(ctx.t("cancelExpiredScheduledLabel"))
          .tooltip(ctx.t("tooltipCancelExpired"))
          .toggle("cancelExpiredScheduled");

        new SettingBuilder(ctx)
          .name(ctx.t("previousDayMigrationLookback"))
          .tooltip(ctx.t("tooltipLookback"))
          .text("previousDayMigrationLookbackDays");

        new SettingBuilder(ctx)
          .name(ctx.t("autoCompleteTaskFamilies"))
          .tooltip(ctx.t("tooltipAutoCompleteFamilies"))
          .toggle("autoCompleteTaskFamilies");

        new SettingBuilder(ctx)
          .name(ctx.t("taskGlobalFilter"))
          .tooltip(ctx.t("tooltipTaskGlobalFilter"))
          .text("taskGlobalFilter");

        new SettingBuilder(ctx)
          .name(ctx.t("linkedFilesEnabled"))
          .tooltip(ctx.t("tooltipLinkedFilesEnabled"))
          .toggle("linkedFilesEnabled");

        new SettingBuilder(ctx)
          .name(ctx.t("linkedFilesFilter"))
          .tooltip(ctx.t("tooltipLinkedFilesFilter"))
          .text("linkedFilesFilter");

        new SettingBuilder(ctx)
          .name(ctx.t("linkedFilesScanRoot"))
          .tooltip(ctx.t("tooltipLinkedFilesScanRoot"))
          .text("linkedFilesScanRoot");
      }
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

/* ============================================
   FILE SUGGEST MODAL
   ============================================ */

import { FuzzySuggestModal, TFile } from "obsidian";

class FileSuggestModal extends FuzzySuggestModal<TFile> {
  private onSelect: (path: string) => void;

  constructor(app: import("obsidian").App, onSelect: (path: string) => void) {
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
