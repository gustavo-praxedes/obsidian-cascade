import type { SectionContext, SettingsSection } from "../settings-section";
import { SettingBuilder } from "../setting-builder";

export class MigrationSection implements SettingsSection {
  readonly id = "migration";
  readonly icon = "🔄";
  readonly labelKey = "sectionMigration";

  render(ctx: SectionContext): void {
    this.renderCard(ctx, "🔄", ctx.t("sectionMigration"), () => {
      new SettingBuilder(ctx)
        .name(ctx.t("runMigrationOnStartup"))
        .tooltip(ctx.t("tooltipRunMigrationOnStartup"))
        .toggle("runMigrationOnStartup");
      new SettingBuilder(ctx)
        .name(ctx.t("runMigrationOnManualOpen"))
        .tooltip(ctx.t("tooltipRunMigrationOnManualOpen"))
        .toggle("runMigrationOnManualOpen");
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
