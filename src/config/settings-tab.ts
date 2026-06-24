import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type CascadePlugin from "../main";

export class CascadeSettingTab extends PluginSettingTab {
  private openSections: Set<string> | null = null;

  constructor(
    app: App,
    private readonly plugin: CascadePlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    if (!this.openSections) {
      this.openSections = new Set();
    }

    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Cascade Settings" });

    this.renderSection("Geral", true, (section) => {
      new Setting(section)
        .setName("Language")
        .addDropdown((dropdown) => {
          dropdown
            .addOption("auto", "Auto")
            .addOption("pt-BR", "pt-BR")
            .addOption("en-US", "en-US")
            .setValue(this.plugin.settings.language)
            .onChange(async (value) => {
              this.plugin.settings.language = value as any;
              await this.plugin.saveSettings();
              this.display();
            });
        });

      new Setting(section)
        .setName("Start Cascade On Startup")
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.startCascadeOnStartup).onChange(async (value) => {
            this.plugin.settings.startCascadeOnStartup = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );
        
      if (!this.plugin.settings.startCascadeOnStartup) {
        new Setting(section)
          .setName("Manual Start")
          .setDesc("Como o Cascade não inicia automaticamente, você pode iniciar manualmente aqui.")
          .addButton((button) => {
            button.setButtonText("Start Cascade").onClick(() => {
              // @ts-ignore
              this.app.commands.executeCommandById("obsidian-cascade:start-cascade");
            });
          });
      }
    });

    this.renderSection("Agenda", false, (section) => {
      this.addToggle(section, "openTodayOnStartup", "Open Today on Startup");
      this.addText(section, "Agenda Root", "", "agendaRoot");

      this.addToggleRefresh(section, "yearlyEnabled", "Yearly Enabled");
      if (this.plugin.settings.yearlyEnabled) {
        this.addText(section, "Yearly Format", "", "yearlyFormat");
        this.addText(section, "Yearly Template", "", "yearlyTemplate");
        this.addText(section, "Yearly Folder", "", "yearlyFolder");
        new Setting(section).setName("Operational Year Start Month (1 = Jan)").addText(t => 
           t.setValue(String(this.plugin.settings.operationalYearStartMonth)).onChange(async v => {
              this.plugin.settings.operationalYearStartMonth = Number(v);
              await this.plugin.saveSettings();
           })
        );
      }

      this.addToggleRefresh(section, "monthlyEnabled", "Monthly Enabled");
      if (this.plugin.settings.monthlyEnabled) {
        this.addText(section, "Monthly Format", "", "monthlyFormat");
        this.addText(section, "Monthly Template", "", "monthlyTemplate");
        this.addText(section, "Monthly Folder", "", "monthlyFolder");
      }

      this.addToggleRefresh(section, "weeklyEnabled", "Weekly Enabled");
      if (this.plugin.settings.weeklyEnabled) {
        this.addText(section, "Weekly Format", "", "weeklyFormat");
        this.addText(section, "Weekly Template", "", "weeklyTemplate");
        this.addText(section, "Weekly Folder", "", "weeklyFolder");
      }

      new Setting(section).setName("Daily").setHeading();
      this.addText(section, "Daily Format", "", "dailyFormat");
      this.addText(section, "Daily Template", "", "dailyTemplate");
      this.addText(section, "Daily Folder", "", "dailyFolder");
    });

    this.renderSection("Migração", false, (section) => {
      this.addToggle(section, "runMigrationOnStartup", "Run Migration on Startup");
      this.addToggle(section, "runMigrationOnManualOpen", "Run Migration on Manual Open");
    });

    this.renderSection("Normalização", false, (section) => {
      this.addToggleRefresh(section, "normalizerEnabled", "Normalizer Enabled");
      if (!this.plugin.settings.normalizerEnabled) {
        this.addToggleRefresh(section, "runNormalizerOnStartup", "Run Normalizer on Startup");
        if (!this.plugin.settings.runNormalizerOnStartup) {
          new Setting(section).setName("Normalize Delay Seconds").addText(t => 
             t.setValue(String(this.plugin.settings.normalizeDelaySeconds)).onChange(async v => {
                this.plugin.settings.normalizeDelaySeconds = Number(v);
                await this.plugin.saveSettings();
             })
          );
        }
      }

      new Setting(section).setName("Normalizer Case").addDropdown(d => 
         d.addOption("none", "Não alterar")
          .addOption("uppercase", "MAIÚSCULA")
          .addOption("lowercase", "MINÚSCULA")
          .addOption("title", "Primeira Em Maiúscula")
          .setValue(this.plugin.settings.normalizerCase)
          .onChange(async v => {
            this.plugin.settings.normalizerCase = v as any;
            await this.plugin.saveSettings();
          })
      );
      this.addToggle(section, "normalizerAccents", "Normalizer Accents");
      this.addToggle(section, "addTimestamp", "Add Timestamp");

      new Setting(section).setName("Normalizer Scopes").setDesc("Um caminho por linha.").addTextArea(t => 
         t.setValue(this.plugin.settings.normalizerScopes.join("\n")).onChange(async v => {
            this.plugin.settings.normalizerScopes = v.split("\n").map(s => s.trim()).filter(s => s);
            await this.plugin.saveSettings();
         })
      );

      new Setting(section).setName("Normalizer Ignored").setDesc("Um caminho por linha.").addTextArea(t => 
         t.setValue(this.plugin.settings.normalizerIgnored.join("\n")).onChange(async v => {
            this.plugin.settings.normalizerIgnored = v.split("\n").map(s => s.trim()).filter(s => s);
            await this.plugin.saveSettings();
         })
      );

      new Setting(section)
        .setName("Substituições de caracteres")
        .setDesc("Um par por linha no formato  de→para  (ex: \" \"→\"-\" ou \"ç\"→\"c\"). Use → para separar.");
      const replacementsContainer = section.createDiv({ cls: "cascade-replacements" });
      const renderReplacements = (): void => {
        replacementsContainer.empty();
        const list = this.plugin.settings.normalizerReplacements;
        list.forEach((rep, index) => {
          const row = replacementsContainer.createDiv({ cls: "cascade-replacement-row" });
          const fromInput = row.createEl("input", { type: "text", attr: { placeholder: "de", value: rep.from, style: "width:80px" } });
          row.createSpan({ text: " → " });
          const toInput = row.createEl("input", { type: "text", attr: { placeholder: "para", value: rep.to, style: "width:80px" } });
          const save = async (): Promise<void> => {
            list[index] = { from: fromInput.value, to: toInput.value };
            await this.plugin.saveSettings();
          };
          fromInput.addEventListener("change", save);
          toInput.addEventListener("change", save);
          const removeBtn = row.createEl("button", { text: "✕", attr: { style: "margin-left:4px" } });
          removeBtn.addEventListener("click", async () => {
            this.plugin.settings.normalizerReplacements.splice(index, 1);
            await this.plugin.saveSettings();
            renderReplacements();
          });
        });
        const addBtn = replacementsContainer.createEl("button", { text: "+ Adicionar substituição", attr: { style: "margin-top:4px;display:block" } });
        addBtn.addEventListener("click", async () => {
          this.plugin.settings.normalizerReplacements.push({ from: "", to: "" });
          await this.plugin.saveSettings();
          renderReplacements();
        });
      };
      renderReplacements();
    });

    this.renderSection("Tarefas", false, (section) => {
      this.addToggleRefresh(section, "migrationEnabled", "Migration Enabled");
      if (this.plugin.settings.migrationEnabled) {
         this.addText(section, "Recurring Tasks Path", "", "recurringTasksPath");
         this.addToggle(section, "taskSetCreatedDate", "Set Created Date");
         this.addToggle(section, "taskSetDoneDate", "Set Done Date");
         this.addToggle(section, "cancelExpiredScheduled", "Cancel Expired Scheduled");
         new Setting(section).setName("Previous Day Migration Lookback").addText(t => 
            t.setValue(String(this.plugin.settings.previousDayMigrationLookbackDays)).onChange(async v => {
               this.plugin.settings.previousDayMigrationLookbackDays = Number(v);
               await this.plugin.saveSettings();
            })
         );
         this.addToggle(section, "autoCompleteTaskFamilies", "Auto Complete Task Families");
         this.addText(section, "Task Global Filter", "", "taskGlobalFilter");
      }
    });

    this.renderSection("Checkbox", false, (section) => this.renderStatusSettings(section));

    this.renderSection("Calendário", false, (section) => {
      new Setting(section)
        .setName("Exibir botão na barra lateral")
        .setDesc("Mostra um ícone de calendário na ribbon do Obsidian para abrir/fechar o calendário.")
        .addToggle(t =>
          t.setValue(this.plugin.settings.calendarShowRibbonButton).onChange(async (value) => {
            this.plugin.settings.calendarShowRibbonButton = value;
            await this.plugin.saveSettings();
            this.plugin.updateCalendarRibbon();
          })
        );
      new Setting(section).setName("First Day Of Week (0=Dom, 1=Seg)").addText(t => 
         t.setValue(String(this.plugin.settings.calendarFirstDayOfWeek)).onChange(async v => {
            this.plugin.settings.calendarFirstDayOfWeek = Number(v) as 0|1;
            await this.plugin.saveSettings();
         })
      );
      this.addToggle(section, "calendarShowWeekNumber", "Show Week Number");
      this.addToggle(section, "calendarOpenInNewLeaf", "Open In New Leaf");
      this.addToggle(section, "calendarConfirmCreate", "Confirm Create");
    });

    this.renderSection("Frontmatter", false, (section) => {
      this.addToggle(section, "frontmatterEnabled", "Enabled");
      this.addText(section, "Created Key", "", "frontmatterCreatedKey");
      this.addText(section, "Updated Key", "", "frontmatterUpdatedKey");
      this.addText(section, "Date Format", "", "frontmatterDateFormat");
      new Setting(section).setName("Ignored Paths").setDesc("Um caminho por linha.").addTextArea(t => 
         t.setValue(this.plugin.settings.frontmatterIgnoredPaths.join("\n")).onChange(async v => {
            this.plugin.settings.frontmatterIgnoredPaths = v.split("\n").map(s => s.trim()).filter(s => s);
            await this.plugin.saveSettings();
         })
      );
    });

    this.renderSection("Avançado", false, (section) => {
      this.renderLoggingSubSection(section);
    });
  }

  private renderLoggingSubSection(parent: HTMLElement): void {
    const details = parent.createEl("details", { cls: "cascade-settings-section cascade-settings-subsection" });
    details.open = this.openSections!.has("Log Interno");
    details.addEventListener("toggle", () => {
      if (details.open) {
        this.openSections!.add("Log Interno");
      } else {
        this.openSections!.delete("Log Interno");
      }
    });
    details.createEl("summary", { text: "Log Interno" });
    const content = details.createDiv({ cls: "cascade-settings-section__content" });

    new Setting(content)
      .setName("Ativar log interno")
      .setDesc("Gera arquivos .md com registros de operações do plugin.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.loggingEnabled).onChange(async (value) => {
          this.plugin.settings.loggingEnabled = value;
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    if (this.plugin.settings.loggingEnabled) {
      new Setting(content)
        .setName("Pasta de logs")
        .setDesc("Onde o arquivo de log será salvo. Deixe vazio para a raiz do vault.")
        .addText((text) =>
          text
            .setPlaceholder("ex: Logs/Cascade")
            .setValue(this.plugin.settings.loggingFolder)
            .onChange(async (value) => {
              this.plugin.settings.loggingFolder = value.trim();
              await this.plugin.saveSettings();
            }),
        );

      new Setting(content)
        .setName("Nome do arquivo de log")
        .setDesc("Nome do arquivo .md. Se incluir /, será tratado como caminho completo (ignora a pasta).")
        .addText((text) =>
          text
            .setPlaceholder("cascade-log.md")
            .setValue(this.plugin.settings.loggingFilename)
            .onChange(async (value) => {
              this.plugin.settings.loggingFilename = value.trim() || "cascade-log.md";
              await this.plugin.saveSettings();
            }),
        );

      new Setting(content)
        .setName("Retenção de logs (dias)")
        .setDesc("Apaga entradas antigas acima deste limite. 0 = sem limite.")
        .addText((text) =>
          text
            .setValue(String(this.plugin.settings.loggingRetentionDays))
            .onChange(async (value) => {
              this.plugin.settings.loggingRetentionDays = Number(value) || 0;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(content).setName("Categorias").setDesc("Escolha o que deseja registrar no log.").setHeading();

      this.addToggle(content, "loggingStartup", "Startup");
      this.addToggle(content, "loggingMigration", "Migração");
      this.addToggle(content, "loggingNormalizer", "Normalização");
      this.addToggle(content, "loggingErrors", "Erros");
    }
  }

  private renderSection(title: string, defaultOpen: boolean, render: (container: HTMLElement) => void): void {
    const details = this.containerEl.createEl("details", { cls: "cascade-settings-section" });
    details.open = this.openSections!.has(title);
    details.addEventListener("toggle", () => {
      if (details.open) {
        this.openSections!.add(title);
      } else {
        this.openSections!.delete(title);
      }
    });
    details.createEl("summary", { text: title });
    const content = details.createDiv({ cls: "cascade-settings-section__content" });
    render(content);
  }

  private addToggle(parent: HTMLElement, key: keyof typeof this.plugin.settings, name: string): void {
    new Setting(parent)
      .setName(name)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings[key] as boolean).onChange(async (value) => {
          (this.plugin.settings as any)[key] = value;
          await this.plugin.saveSettings();
        }),
      );
  }

  private addToggleRefresh(parent: HTMLElement, key: keyof typeof this.plugin.settings, name: string): void {
    new Setting(parent)
      .setName(name)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings[key] as boolean).onChange(async (value) => {
          (this.plugin.settings as any)[key] = value;
          await this.plugin.saveSettings();
          this.display();
        }),
      );
  }

  private addText(parent: HTMLElement, name: string, desc: string, key: keyof typeof this.plugin.settings): void {
    new Setting(parent)
      .setName(name)
      .setDesc(desc)
      .addText((text) =>
        text.setValue(String(this.plugin.settings[key] ?? "")).onChange(async (value) => {
          (this.plugin.settings as any)[key] = value.trim();
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
