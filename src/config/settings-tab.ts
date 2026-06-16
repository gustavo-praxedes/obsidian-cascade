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

    this.renderSection("Agenda", true, (section) => {
      new Setting(section)
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

      new Setting(section)
        .setName(this.plugin.i18n.t("agendaRoot"))
        .addText((text) =>
          text.setValue(this.plugin.settings.agendaRoot).onChange(async (value) => {
            this.plugin.settings.agendaRoot = value.trim();
            await this.plugin.saveSettings();
          }),
        );

      new Setting(section)
        .setName(this.plugin.i18n.t("recurringTasksPath"))
        .addText((text) =>
          text.setValue(this.plugin.settings.recurringTasksPath).onChange(async (value) => {
            this.plugin.settings.recurringTasksPath = value.trim();
            await this.plugin.saveSettings();
          }),
        );

      this.addToggle(section, "weeklyEnabled");

      new Setting(section)
        .setName(this.plugin.i18n.t("weeklyStructure"))
        .addDropdown((dropdown) =>
          dropdown
            .addOption("folder-index", this.plugin.i18n.t("weeklyStructureFolderIndex"))
            .addOption("flat", this.plugin.i18n.t("weeklyStructureFlat"))
            .setValue(this.plugin.settings.weeklyStructure)
            .onChange(async (value) => {
              this.plugin.settings.weeklyStructure = value as typeof this.plugin.settings.weeklyStructure;
              await this.plugin.saveSettings();
            }),
        );
    });

    this.renderSection("Formatos e templates", false, (section) => {
      this.addText(section, "Formato diario", "Formato do nome do arquivo diario.", "dailyFormat");
      this.addText(section, "Formato semanal", "Formato do nome do arquivo semanal.", "weeklyFormat");
      this.addText(section, "Formato mensal", "Formato do nome do arquivo mensal.", "monthlyFormat");
      this.addText(section, "Formato anual", "Formato do nome do arquivo anual.", "yearlyFormat");
      this.addText(section, "Formato de nota comum", "Formato do nome para notas comuns.", "noteFormat");
      this.addText(section, "Pasta de templates", "Pasta raiz usada para localizar templates.", "templatesFolder");
      this.addText(section, "Template diario", "Template usado ao criar logs diarios.", "dailyTemplate");
      this.addText(section, "Template semanal", "Template usado ao criar logs semanais.", "weeklyTemplate");
      this.addText(section, "Template mensal", "Template usado ao criar logs mensais.", "monthlyTemplate");
      this.addText(section, "Template anual", "Template usado ao criar logs anuais.", "yearlyTemplate");
    });

    this.renderSection("Startup e migracao", false, (section) => {
      this.addToggle(section, "openTodayOnStartup");
      this.addToggle(section, "runMigrationOnStartup");
      this.addToggle(section, "runNormalizerOnStartup");
      this.addToggle(section, "migrationEnabled");
      this.addToggle(section, "cancelExpiredScheduled");
      new Setting(section)
        .setName("Dias anteriores para buscar tarefas abertas")
        .setDesc("Limite de dias antes de hoje que o Cascade verifica ao carregar tarefas pendentes.")
        .addSlider((slider) =>
          slider
            .setLimits(0, 30, 1)
            .setValue(this.plugin.settings.previousDayMigrationLookbackDays)
            .setDynamicTooltip()
            .onChange(async (value) => {
              this.plugin.settings.previousDayMigrationLookbackDays = value;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(section)
        .setName("Concluir pais e filhas automaticamente")
        .setDesc("Ao concluir uma tarefa pai, conclui filhas abertas/em progresso; ao concluir todas as filhas, conclui a pai.")
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.autoCompleteTaskFamilies).onChange(async (value) => {
            this.plugin.settings.autoCompleteTaskFamilies = value;
            await this.plugin.saveSettings();
          }),
        );
    });

    this.renderSection("Status de checkbox", false, (section) => this.renderStatusSettings(section));

    // Internal startup controls intentionally kept out of the UI for now:
    // startupWaitMaxSeconds, startupVaultIdleSeconds, and runMigrationOnManualOpen.
    // Uncomment explicit Setting controls here when the user decides to expose them.
  }

  private renderSection(title: string, open: boolean, render: (container: HTMLElement) => void): void {
    const details = this.containerEl.createEl("details", { cls: "cascade-settings-section" });
    details.open = open;
    details.createEl("summary", { text: title });
    const content = details.createDiv({ cls: "cascade-settings-section__content" });
    render(content);
  }

  private addToggle(
    parent: HTMLElement,
    key: "openTodayOnStartup" | "runMigrationOnStartup" | "runNormalizerOnStartup" | "migrationEnabled" | "cancelExpiredScheduled" | "weeklyEnabled",
  ): void {
    new Setting(parent)
      .setName(this.plugin.i18n.t(key))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings[key]).onChange(async (value) => {
          this.plugin.settings[key] = value;
          await this.plugin.saveSettings();
          new Notice(this.plugin.i18n.t("settingsSaved"));
        }),
      );
  }

  private addText(parent: HTMLElement, name: string, desc: string, key: TextSettingKey): void {
    new Setting(parent)
      .setName(name)
      .setDesc(desc)
      .addText((text) =>
        text.setValue(String(this.plugin.settings[key] ?? "")).onChange(async (value) => {
          this.plugin.settings[key] = value.trim() as never;
          await this.plugin.saveSettings();
        }),
      );
  }

  private renderStatusSettings(parent: HTMLElement): void {
    new Setting(parent).setName("Status padrao").setDesc("Estes status sao fundamentais e nao podem ser removidos.");
    for (const status of this.plugin.settings.essentialStatuses) {
      const setting = new Setting(parent)
        .setName(status.label)
        .setDesc(`Snippet [${status.symbol}]`);
      setting.nameEl.prepend(this.renderCheckboxSnippet(status.symbol));
      
      const badge = document.createElement("span");
      badge.textContent = "padrao";
      badge.addClass("cascade-status-preview__lock");
      badge.style.marginLeft = "8px";
      setting.nameEl.appendChild(badge);
    }

    new Setting(parent).setName("Status acessorios").setDesc("Status criados pelo usuario podem aparecer ou sumir do menu. Os padroes sempre aparecem.");
    for (const [index, status] of this.plugin.settings.customStatuses.entries()) {
      const setting = new Setting(parent)
        .setName(status.label || "Status sem nome")
        .setDesc(`Snippet [${status.symbol}]`)
        .addToggle((toggle) =>
          toggle.setValue(status.showInMenu !== false).onChange(async (value) => {
            this.plugin.settings.customStatuses[index] = { ...status, showInMenu: value };
            await this.plugin.saveSettings();
          }),
        )
        .addButton((button) =>
          button.setIcon("trash").setTooltip("Remover status").onClick(async () => {
            this.plugin.settings.customStatuses.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          }),
        );
      setting.nameEl.prepend(this.renderCheckboxSnippet(status.symbol));
    }

    let newSymbol = "";
    let newLabel = "";
    let newIcon = "";
    new Setting(parent)
      .setName("Adicionar status acessorio")
      .addText((text) => text.setPlaceholder("simbolo").onChange((value) => (newSymbol = value)))
      .addText((text) => text.setPlaceholder("nome").onChange((value) => (newLabel = value)))
      .addText((text) => text.setPlaceholder("icone").onChange((value) => (newIcon = value)))
      .addButton((button) =>
        button.setButtonText("Adicionar").onClick(async () => {
          const symbol = newSymbol.trim();
          const label = newLabel.trim();
          const icon = newIcon.trim();
          if (!symbol || symbol.length !== 1 || !label) {
            new Notice("Informe um simbolo de 1 caractere e um nome.");
            return;
          }
          if (this.plugin.settings.essentialStatuses.some((item) => item.symbol === symbol) || this.plugin.settings.customStatuses.some((item) => item.symbol === symbol)) {
            new Notice("Esse simbolo ja existe.");
            return;
          }
          this.plugin.settings.customStatuses.push({ symbol, label, icon, essential: false, showInMenu: true });
          await this.plugin.saveSettings();
          this.display();
        }),
      );
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
}

type TextSettingKey =
  | "dailyFormat"
  | "weeklyFormat"
  | "monthlyFormat"
  | "yearlyFormat"
  | "noteFormat"
  | "templatesFolder"
  | "dailyTemplate"
  | "weeklyTemplate"
  | "monthlyTemplate"
  | "yearlyTemplate";
