import { Notice } from "obsidian";
import type { SectionContext, SettingsSection } from "../settings-section";

export class CheckboxSection implements SettingsSection {
  readonly id = "checkbox";
  readonly icon = "🏷️";
  readonly labelKey = "sectionCheckbox";

  render(ctx: SectionContext): void {
    this.renderCard(ctx, "🏷️", ctx.t("sectionCheckbox"), () => {
      this.renderEssentialStatuses(ctx);
      this.renderCustomStatuses(ctx);
      this.renderDisabledStatuses(ctx);
      this.renderAddStatusForm(ctx);
    });
  }

  private renderEssentialStatuses(ctx: SectionContext): void {
    const label = ctx.container.createDiv({ cls: "cascade-dependent-hint" });
    label.textContent = ctx.t("statusDefaultDesc");

    const grid = ctx.container.createDiv({ cls: "cascade-status-grid" });
    for (const status of ctx.settings.essentialStatuses) {
      const card = grid.createDiv({ cls: "cascade-status-card cascade-status-card--essential" });
      card.createSpan({ cls: "cascade-status-card__checkbox" }).appendChild(this.renderCheckboxSnippet(status.symbol));
      const info = card.createDiv({ cls: "cascade-status-card__info" });
      info.createDiv({ cls: "cascade-status-card__label", text: status.label });
      info.createDiv({ cls: "cascade-status-card__meta", text: `[${status.symbol}]` });
      card.createSpan({ cls: "cascade-status-card__badge", text: ctx.t("statusDefaultBadge") });
    }
  }

  private renderCustomStatuses(ctx: SectionContext): void {
    const active = ctx.settings.customStatuses.filter((s) => s.showInMenu !== false);
    if (active.length === 0) return;

    const label = ctx.container.createDiv({ cls: "cascade-dependent-hint" });
    label.textContent = ctx.t("statusAccessoryDesc");

    const grid = ctx.container.createDiv({ cls: "cascade-status-grid" });
    for (const status of active) {
      const index = ctx.settings.customStatuses.indexOf(status);
      const card = grid.createDiv({ cls: "cascade-status-card" });
      card.createSpan({ cls: "cascade-status-card__checkbox" }).appendChild(this.renderCheckboxSnippet(status.symbol));

      const info = card.createDiv({ cls: "cascade-status-card__info" });
      const labelInput = info.createEl("input", {
        type: "text",
        attr: {
          value: status.label,
          "data-field": "label",
          "aria-label": ctx.t("placeholderName"),
        },
      });
      labelInput.addEventListener("change", async () => {
        ctx.settings.customStatuses[index] = { ...status, label: labelInput.value.trim() };
        await ctx.save();
      });

      const meta = info.createDiv({ cls: "cascade-status-card__meta" });
      const symbolInput = meta.createEl("input", {
        type: "text",
        attr: {
          value: status.symbol,
          "data-field": "symbol",
          style: "width:24px;text-align:center;font-family:var(--font-monospace);font-size:12px;padding:2px 4px;border:1px solid var(--background-modifier-border);border-radius:3px;background:var(--background-primary);color:var(--text-normal);",
          "aria-label": ctx.t("placeholderSymbol"),
          maxlength: "1",
        },
      });
      symbolInput.addEventListener("change", async () => {
        const newSymbol = symbolInput.value.trim();
        if (!newSymbol || newSymbol.length !== 1) {
          new Notice(ctx.t("enterSymbolAndName"));
          symbolInput.value = status.symbol;
          return;
        }
        const isDuplicate =
          ctx.settings.essentialStatuses.some((s) => s.symbol === newSymbol) ||
          ctx.settings.customStatuses.some((s, i) => i !== index && s.symbol === newSymbol);
        if (isDuplicate) {
          new Notice(ctx.t("symbolExists"));
          symbolInput.value = status.symbol;
          return;
        }
        ctx.settings.customStatuses[index] = { ...status, symbol: newSymbol };
        await ctx.save();
      });

      const actions = card.createDiv({ cls: "cascade-status-card__actions" });
      const toggle = actions.createEl("input", {
        type: "checkbox",
        attr: {
          "aria-label": ctx.t("statusShowInMenu"),
        },
      });
      toggle.checked = status.showInMenu !== false;
      toggle.addEventListener("change", async () => {
        ctx.settings.customStatuses[index] = { ...status, showInMenu: toggle.checked };
        await ctx.save();
        ctx.refresh();
      });

      const disableBtn = actions.createEl("button", {
        cls: "cascade-row-delete",
        text: "⊘",
        attr: { "aria-label": ctx.t("disableStatus") },
      });
      disableBtn.addEventListener("click", async () => {
        ctx.settings.customStatuses[index] = { ...status, showInMenu: false };
        await ctx.save();
        ctx.refresh();
      });
    }
  }

  private renderDisabledStatuses(ctx: SectionContext): void {
    const disabled = ctx.settings.customStatuses.filter((s) => s.showInMenu === false);
    if (disabled.length === 0) return;

    const label = ctx.container.createDiv({ cls: "cascade-dependent-hint" });
    label.textContent = ctx.t("statusDisabledDesc");

    const grid = ctx.container.createDiv({ cls: "cascade-status-grid" });
    for (const status of disabled) {
      const realIndex = ctx.settings.customStatuses.indexOf(status);
      const card = grid.createDiv({ cls: "cascade-status-card" });
      card.createSpan({ cls: "cascade-status-card__checkbox" }).appendChild(this.renderCheckboxSnippet(status.symbol));

      const info = card.createDiv({ cls: "cascade-status-card__info" });
      info.createDiv({ cls: "cascade-status-card__label", text: status.label });
      info.createDiv({ cls: "cascade-status-card__meta", text: `[${status.symbol}]` });

      const actions = card.createDiv({ cls: "cascade-status-card__actions" });
      const enableBtn = actions.createEl("button", {
        cls: "cascade-settings-btn",
        text: ctx.t("enable"),
      });
      enableBtn.addEventListener("click", async () => {
        ctx.settings.customStatuses[realIndex] = { ...status, showInMenu: true };
        await ctx.save();
        ctx.refresh();
      });

      const removeBtn = actions.createEl("button", {
        cls: "cascade-row-delete",
        text: "✕",
        attr: { "aria-label": ctx.t("removeStatus") },
      });
      removeBtn.addEventListener("click", async () => {
        ctx.settings.customStatuses.splice(realIndex, 1);
        await ctx.save();
        ctx.refresh();
      });
    }
  }

  private renderAddStatusForm(ctx: SectionContext): void {
    const container = ctx.container.createDiv({ cls: "cascade-status-add" });

    const symbolInput = container.createEl("input", {
      type: "text",
      attr: {
        "data-field": "symbol",
        placeholder: ctx.t("placeholderSymbol"),
        maxlength: "1",
        "aria-label": ctx.t("placeholderSymbol"),
      },
    });

    const labelInput = container.createEl("input", {
      type: "text",
      attr: {
        "data-field": "label",
        placeholder: ctx.t("placeholderName"),
        "aria-label": ctx.t("placeholderName"),
      },
    });

    const iconInput = container.createEl("input", {
      type: "text",
      attr: {
        "data-field": "icon",
        placeholder: ctx.t("placeholderIcon"),
        "aria-label": ctx.t("placeholderIcon"),
      },
    });

    const addBtn = container.createEl("button", {
      text: ctx.t("add"),
      cls: "cascade-settings-btn cascade-settings-btn--primary",
    });

    const doAdd = async (): Promise<void> => {
      const symbol = symbolInput.value.trim();
      const label = labelInput.value.trim();
      const icon = iconInput.value.trim();
      if (!symbol || symbol.length !== 1 || !label) {
        new Notice(ctx.t("enterSymbolAndName"));
        return;
      }
      if (
        ctx.settings.essentialStatuses.some((s) => s.symbol === symbol) ||
        ctx.settings.customStatuses.some((s) => s.symbol === symbol)
      ) {
        new Notice(ctx.t("symbolExists"));
        return;
      }
      ctx.settings.customStatuses.push({ symbol, label, icon, essential: false, showInMenu: true });
      await ctx.save();
      symbolInput.value = "";
      labelInput.value = "";
      iconInput.value = "";
      ctx.refresh();
    };

    addBtn.addEventListener("click", doAdd);
    iconInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") void doAdd();
    });
    labelInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") void doAdd();
    });
  }

  private renderCheckboxSnippet(symbol: string): HTMLElement {
    const input = document.createElement("input");
    input.type = "checkbox";
    input.addClass("task-list-item-checkbox");
    input.setAttribute("data-task", symbol);
    if (symbol !== " ") input.checked = true;
    input.disabled = true;
    return input;
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
