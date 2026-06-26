import type { SectionContext, SettingsSection } from "../settings-section";
import { SettingBuilder } from "../setting-builder";

export class NormalizationSection implements SettingsSection {
  readonly id = "normalization";
  readonly icon = "📝";
  readonly labelKey = "sectionNormalization";

  render(ctx: SectionContext): void {
    this.renderCard(ctx, "📝", ctx.t("sectionNormalization"), () => {
      if (ctx.settings.normalizerEnabled) {
        new SettingBuilder(ctx)
          .name(ctx.t("runNormalizerOnStartup"))
          .tooltip(ctx.t("tooltipRunOnStartup"))
          .toggle("runNormalizerOnStartup");

        if (!ctx.settings.runNormalizerOnStartup) {
          new SettingBuilder(ctx)
            .name(ctx.t("normalizeDelaySeconds"))
            .tooltip(ctx.t("tooltipNormalizeDelay"))
            .text("normalizeDelaySeconds");
        }
      }

      new SettingBuilder(ctx)
        .name(ctx.t("normalizerCase"))
        .tooltip(ctx.t("tooltipNormalizerCase"))
        .dropdown("normalizerCase", [
          ["none", ctx.t("normalizerCaseNone")],
          ["uppercase", ctx.t("normalizerCaseUppercase")],
          ["lowercase", ctx.t("normalizerCaseLowercase")],
          ["title", ctx.t("normalizerCaseTitle")],
          ["slug", ctx.t("normalizerCaseSlug")],
          ["sentence", ctx.t("normalizerCaseSentence")],
          ["camelCase", ctx.t("normalizerCaseCamel")],
          ["PascalCase", ctx.t("normalizerCasePascal")],
          ["snake_case", ctx.t("normalizerCaseSnake")],
        ]);

      new SettingBuilder(ctx)
        .name(ctx.t("normalizerAccents"))
        .tooltip(ctx.t("tooltipNormalizerAccents"))
        .toggle("normalizerAccents");

      new SettingBuilder(ctx)
        .name(ctx.t("addTimestamp"))
        .tooltip(ctx.t("tooltipAddTimestamp"))
        .toggle("addTimestamp");

      new SettingBuilder(ctx)
        .name(ctx.t("normalizerScopes"))
        .tooltip(ctx.t("tooltipNormalizerScopes"))
        .desc(ctx.t("onePathPerLine"))
        .textarea("normalizerScopes");

      new SettingBuilder(ctx)
        .name(ctx.t("normalizerIgnored"))
        .tooltip(ctx.t("tooltipNormalizerIgnored"))
        .desc(ctx.t("onePathPerLine"))
        .textarea("ignoredPaths");
    });

    this.renderCard(ctx, "🔄", ctx.t("sectionReplacements"), () => {
      this.renderReplacementsInline(ctx);
    });
  }

  private renderReplacementsInline(ctx: SectionContext): void {
    const list = ctx.settings.normalizerReplacements;

    const summary = ctx.container.createDiv({ cls: "cascade-dependent-hint" });
    const count = list.length;
    summary.textContent = count === 0
      ? ctx.t("noReplacements")
      : ctx.t("replacementsCount").replace("{count}", String(count));

    const table = ctx.container.createEl("table", { cls: "cascade-replacements-table" });
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.createEl("th", { text: "↕" });
    headerRow.createEl("th", { text: ctx.t("placeholderFrom") });
    headerRow.createEl("th", { text: ctx.t("placeholderTo") });
    headerRow.createEl("th", { text: "" });

    const tbody = table.createEl("tbody");

    const renderRows = (): void => {
      tbody.empty();
      list.forEach((rep, index) => {
        const row = tbody.createEl("tr", { attr: { draggable: "true", "data-index": String(index) } });

        const handleCell = row.createEl("td");
        handleCell.createSpan({ cls: "cascade-drag-handle", text: "⋮" });

        const fromCell = row.createEl("td");
        const fromInput = fromCell.createEl("input", {
          type: "text",
          attr: { placeholder: ctx.t("placeholderFrom"), value: rep.from },
        });

        const toCell = row.createEl("td");
        const toInput = toCell.createEl("input", {
          type: "text",
          attr: { placeholder: ctx.t("placeholderTo"), value: rep.to },
        });

        const save = async (): Promise<void> => {
          list[index] = { from: fromInput.value, to: toInput.value };
          await ctx.save();
        };
        fromInput.addEventListener("change", save);
        toInput.addEventListener("change", save);

        const actionsCell = row.createEl("td");
        const deleteBtn = actionsCell.createEl("button", { cls: "cascade-row-delete", text: "✕" });
        deleteBtn.addEventListener("click", async () => {
          list.splice(index, 1);
          await ctx.save();
          renderRows();
          updateSummary();
        });

        // Drag and drop
        row.addEventListener("dragstart", (e) => {
          row.addClass("is-dragging");
          if (e.dataTransfer) {
            e.dataTransfer.setData("text/plain", String(index));
            e.dataTransfer.effectAllowed = "move";
          }
        });

        row.addEventListener("dragend", () => {
          row.removeClass("is-dragging");
          tbody.findAll("tr.is-drag-over").forEach((r) => r.removeClass("is-drag-over"));
        });

        row.addEventListener("dragover", (e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
          row.addClass("is-drag-over");
        });

        row.addEventListener("dragleave", () => {
          row.removeClass("is-drag-over");
        });

        row.addEventListener("drop", async (e) => {
          e.preventDefault();
          row.removeClass("is-drag-over");
          const fromIndex = Number(e.dataTransfer?.getData("text/plain") ?? "");
          if (isNaN(fromIndex) || fromIndex === index) return;
          const [moved] = list.splice(fromIndex, 1);
          list.splice(index, 0, moved);
          await ctx.save();
          renderRows();
        });
      });
    };

    const updateSummary = (): void => {
      const c = list.length;
      summary.textContent = c === 0
        ? ctx.t("noReplacements")
        : ctx.t("replacementsCount").replace("{count}", String(c));
    };

    renderRows();

    const addBtn = ctx.container.createEl("button", {
      text: ctx.t("addReplacement"),
      cls: "cascade-settings-btn",
      attr: { style: "margin-top:8px" },
    });
    addBtn.addEventListener("click", async () => {
      list.push({ from: "", to: "" });
      await ctx.save();
      renderRows();
      updateSummary();
      const lastInput = tbody.querySelectorAll("input")[tbody.querySelectorAll("input").length - 2];
      (lastInput as HTMLInputElement)?.focus();
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
