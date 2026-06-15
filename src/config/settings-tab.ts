import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type CascadePlugin from "../main";

export class CascadeSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: CascadePlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: this.plugin.i18n.t("settingsTitle") });

    new Setting(containerEl)
      .setName(this.plugin.i18n.t("language"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("auto", "Auto")
          .addOption("pt-BR", "pt-BR")
          .addOption("en-US", "en-US")
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value as typeof this.plugin.settings.language;
            await this.plugin.saveSettings();
            this.display();
          });
      });

    new Setting(containerEl)
      .setName(this.plugin.i18n.t("agendaRoot"))
      .addText((text) =>
        text.setValue(this.plugin.settings.agendaRoot).onChange(async (value) => {
          this.plugin.settings.agendaRoot = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(this.plugin.i18n.t("recurringTasksPath"))
      .addText((text) =>
        text.setValue(this.plugin.settings.recurringTasksPath).onChange(async (value) => {
          this.plugin.settings.recurringTasksPath = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    this.addToggle("openTodayOnStartup");
    this.addToggle("runMigrationOnStartup");
    this.addToggle("runNormalizerOnStartup");

    new Setting(containerEl)
      .setName("Startup delay")
      .addSlider((slider) =>
        slider
          .setLimits(0, 60, 1)
          .setValue(this.plugin.settings.startupDelaySeconds)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.startupDelaySeconds = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Startup wait condition")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("fixed", "Fixed")
          .addOption("until-daily", "Until daily exists")
          .addOption("until-vault-idle", "Until vault idle")
          .addOption("combined", "Combined")
          .setValue(this.plugin.settings.startupWaitCondition)
          .onChange(async (value) => {
            this.plugin.settings.startupWaitCondition = value as typeof this.plugin.settings.startupWaitCondition;
            await this.plugin.saveSettings();
          }),
      );
  }

  private addToggle(key: "openTodayOnStartup" | "runMigrationOnStartup" | "runNormalizerOnStartup"): void {
    new Setting(this.containerEl)
      .setName(this.plugin.i18n.t(key))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
          this.plugin.settings[key] = value;
          await this.plugin.saveSettings();
          new Notice(this.plugin.i18n.t("settingsSaved"));
        }),
      );
  }
}
