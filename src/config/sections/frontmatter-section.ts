import type { SectionContext, SettingsSection } from "../settings-section";
import { SettingBuilder } from "../setting-builder";

export class FrontmatterSection implements SettingsSection {
  readonly id = "frontmatter";
  readonly icon = "📄";
  readonly labelKey = "sectionFrontmatter";

  render(ctx: SectionContext): void {
    this.renderCard(ctx, "📄", ctx.t("sectionFrontmatter"), () => {
      if (ctx.settings.frontmatterEnabled) {
        new SettingBuilder(ctx)
          .name(ctx.t("frontmatterCreatedKey"))
          .tooltip(ctx.t("tooltipFrontmatterCreatedKey"))
          .text("frontmatterCreatedKey");

        new SettingBuilder(ctx)
          .name(ctx.t("frontmatterUpdatedKey"))
          .tooltip(ctx.t("tooltipFrontmatterUpdatedKey"))
          .text("frontmatterUpdatedKey");

        new SettingBuilder(ctx)
          .name(ctx.t("frontmatterDateFormat"))
          .tooltip(ctx.t("tooltipFrontmatterDateFormat"))
          .text("frontmatterDateFormat");
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
