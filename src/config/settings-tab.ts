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

  private t(key: string): string {
    return this.plugin.i18n.t(key as any);
  }

  display(): void {
    if (!this.openSections) {
      this.openSections = new Set();
    }

    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: this.t("settingsTitle") });

    this.renderSection(this.t("sectionGeneral"), true, (section) => {
      new Setting(section)
        .setName(this.t("language"))
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
        .setName(this.t("startCascadeOnStartup"))
        .addToggle((toggle) =>
          toggle.setValue(this.plugin.settings.startCascadeOnStartup).onChange(async (value) => {
            this.plugin.settings.startCascadeOnStartup = value;
            await this.plugin.saveSettings();
            this.display();
          })
        );
        
      if (!this.plugin.settings.startCascadeOnStartup) {
        new Setting(section)
          .setName(this.t("manualStart"))
          .setDesc(this.t("manualStartDesc"))
          .addButton((button) => {
            button.setButtonText(this.t("startCascadeButton")).onClick(() => {
              // @ts-ignore
              this.app.commands.executeCommandById("obsidian-cascade:start-cascade");
            });
          });
      }
    });

    this.renderSection(this.t("sectionAgenda"), false, (section) => {
      this.addText(section, this.t("agendaRoot"), "", "agendaRoot");

      this.renderSubSection(section, this.t("sectionAnnual"), (sub) => {
        this.addToggleRefresh(sub, "yearlyEnabled", this.t("yearlyEnabled"));
        if (this.plugin.settings.yearlyEnabled) {
          this.addToggle(sub, "openAnnualOnStartup", this.t("openOnStartup"));
          this.addText(sub, this.t("yearlyFormat"), "", "yearlyFormat");
          this.addText(sub, this.t("yearlyTemplate"), "", "yearlyTemplate");
          this.addText(sub, this.t("yearlyFolder"), "", "yearlyFolder");
          new Setting(sub).setName(this.t("operationalYearStartMonth")).addText(t => 
             t.setValue(String(this.plugin.settings.operationalYearStartMonth)).onChange(async v => {
                this.plugin.settings.operationalYearStartMonth = Number(v);
                await this.plugin.saveSettings();
             })
          );
        }
      });

      this.renderSubSection(section, this.t("sectionMonthly"), (sub) => {
        this.addToggleRefresh(sub, "monthlyEnabled", this.t("monthlyEnabled"));
        if (this.plugin.settings.monthlyEnabled) {
          this.addToggle(sub, "openMonthlyOnStartup", this.t("openOnStartup"));
          this.addText(sub, this.t("monthlyFormat"), "", "monthlyFormat");
          this.addText(sub, this.t("monthlyTemplate"), "", "monthlyTemplate");
          this.addText(sub, this.t("monthlyFolder"), "", "monthlyFolder");
        }
      });

      this.renderSubSection(section, this.t("sectionWeekly"), (sub) => {
        this.addToggleRefresh(sub, "weeklyEnabled", this.t("weeklyEnabled"));
        if (this.plugin.settings.weeklyEnabled) {
          this.addToggle(sub, "openWeeklyOnStartup", this.t("openOnStartup"));
          this.addText(sub, this.t("weeklyFormat"), "", "weeklyFormat");
          this.addText(sub, this.t("weeklyTemplate"), "", "weeklyTemplate");
          this.addText(sub, this.t("weeklyFolder"), "", "weeklyFolder");
        }
      });

      this.renderSubSection(section, this.t("sectionDaily"), (sub) => {
        this.addToggle(sub, "openDailyOnStartup", this.t("openOnStartup"));
        this.addText(sub, this.t("dailyFormat"), "", "dailyFormat");
        this.addText(sub, this.t("dailyTemplate"), "", "dailyTemplate");
        this.addText(sub, this.t("dailyFolder"), "", "dailyFolder");
      });
    });

    this.renderSection(this.t("sectionMigration"), false, (section) => {
      this.addToggle(section, "runMigrationOnStartup", this.t("runMigrationOnStartup"));
      this.addToggle(section, "runMigrationOnManualOpen", this.t("runMigrationOnManualOpen"));
    });

    this.renderSection(this.t("sectionNormalization"), false, (section) => {
      this.addToggleRefresh(section, "normalizerEnabled", this.t("normalizerEnabled"));

      this.renderSubSection(section, this.t("sectionSettings"), (sub) => {
        if (this.plugin.settings.normalizerEnabled) {
          this.addToggleRefresh(sub, "runNormalizerOnStartup", this.t("runNormalizerOnStartup"));
          if (!this.plugin.settings.runNormalizerOnStartup) {
            new Setting(sub).setName(this.t("normalizeDelaySeconds")).addText(t => 
               t.setValue(String(this.plugin.settings.normalizeDelaySeconds)).onChange(async v => {
                  this.plugin.settings.normalizeDelaySeconds = Number(v);
                  await this.plugin.saveSettings();
               })
            );
          }
        }

        new Setting(sub).setName(this.t("normalizerCase")).addDropdown(d => 
           d.addOption("none", this.t("normalizerCaseNone"))
            .addOption("uppercase", this.t("normalizerCaseUppercase"))
            .addOption("lowercase", this.t("normalizerCaseLowercase"))
            .addOption("title", this.t("normalizerCaseTitle"))
            .addOption("slug", this.t("normalizerCaseSlug"))
            .addOption("sentence", this.t("normalizerCaseSentence"))
            .addOption("camelCase", this.t("normalizerCaseCamel"))
            .addOption("PascalCase", this.t("normalizerCasePascal"))
            .addOption("snake_case", this.t("normalizerCaseSnake"))
            .setValue(this.plugin.settings.normalizerCase)
            .onChange(async v => {
              this.plugin.settings.normalizerCase = v as any;
              await this.plugin.saveSettings();
            })
        );
        this.addToggle(sub, "normalizerAccents", this.t("normalizerAccents"));
        this.addToggle(sub, "addTimestamp", this.t("addTimestamp"));

        new Setting(sub).setName(this.t("normalizerScopes")).setDesc(this.t("onePathPerLine")).addTextArea(t => 
           t.setValue(this.plugin.settings.normalizerScopes.join("\n")).onChange(async v => {
              this.plugin.settings.normalizerScopes = v.split("\n").map(s => s.trim()).filter(s => s);
              await this.plugin.saveSettings();
           })
        );

        new Setting(sub).setName(this.t("normalizerIgnored")).setDesc(this.t("onePathPerLine")).addTextArea(t => 
           t.setValue(this.plugin.settings.normalizerIgnored.join("\n")).onChange(async v => {
              this.plugin.settings.normalizerIgnored = v.split("\n").map(s => s.trim()).filter(s => s);
              await this.plugin.saveSettings();
           })
        );
      });

      this.renderSubSection(section, this.t("sectionReplacements"), (sub) => {
        new Setting(sub)
          .setName(this.t("replacementsTitle"))
          .setDesc(this.t("replacementsDesc"));
        const replacementsContainer = sub.createDiv({ cls: "cascade-replacements" });
        const renderReplacements = (): void => {
          replacementsContainer.empty();
          const list = this.plugin.settings.normalizerReplacements;
          list.forEach((rep, index) => {
            const row = replacementsContainer.createDiv({ cls: "cascade-replacement-row" });
            const fromInput = row.createEl("input", { type: "text", attr: { placeholder: this.t("placeholderFrom"), value: rep.from, style: "width:80px" } });
            row.createSpan({ text: " \u2192 " });
            const toInput = row.createEl("input", { type: "text", attr: { placeholder: this.t("placeholderTo"), value: rep.to, style: "width:80px" } });
            const save = async (): Promise<void> => {
              list[index] = { from: fromInput.value, to: toInput.value };
              await this.plugin.saveSettings();
            };
            fromInput.addEventListener("change", save);
            toInput.addEventListener("change", save);
            const removeBtn = row.createEl("button", { text: "\u2715", attr: { style: "margin-left:4px" } });
            removeBtn.addEventListener("click", async () => {
              this.plugin.settings.normalizerReplacements.splice(index, 1);
              await this.plugin.saveSettings();
              renderReplacements();
            });
          });
          const addBtn = replacementsContainer.createEl("button", { text: this.t("addReplacement"), attr: { style: "margin-top:4px;display:block" } });
          addBtn.addEventListener("click", async () => {
            this.plugin.settings.normalizerReplacements.push({ from: "", to: "" });
            await this.plugin.saveSettings();
            renderReplacements();
          });
        };
        renderReplacements();
      });
    });

    this.renderSection(this.t("sectionTasks"), false, (section) => {
      this.addToggleRefresh(section, "migrationEnabled", this.t("migrationEnabled"));

      this.renderSubSection(section, this.t("sectionMigration"), (sub) => {
        if (this.plugin.settings.migrationEnabled) {
          this.addText(sub, this.t("recurringTasksPathLabel"), "", "recurringTasksPath");
          this.addToggle(sub, "taskSetCreatedDate", this.t("taskSetCreatedDate"));
          this.addToggle(sub, "taskSetDoneDate", this.t("taskSetDoneDate"));
          this.addToggle(sub, "cancelExpiredScheduled", this.t("cancelExpiredScheduledLabel"));
          new Setting(sub).setName(this.t("previousDayMigrationLookback")).addText(t => 
             t.setValue(String(this.plugin.settings.previousDayMigrationLookbackDays)).onChange(async v => {
                this.plugin.settings.previousDayMigrationLookbackDays = Number(v);
                await this.plugin.saveSettings();
             })
          );
          this.addToggle(sub, "autoCompleteTaskFamilies", this.t("autoCompleteTaskFamilies"));
          this.addText(sub, this.t("taskGlobalFilter"), "", "taskGlobalFilter");

          const delayPresets = [0, 5, 10, 30];
          new Setting(sub)
            .setName(this.t("startupDelay"))
            .setDesc(this.t("startupDelayDesc"))
            .addDropdown((dd) => {
              for (const sec of delayPresets) dd.addOption(String(sec), `${sec}s`);
              dd.addOption("custom", "Custom...");
              const current = this.plugin.settings.startupDelaySeconds;
              const isPreset = delayPresets.includes(current);
              dd.setValue(isPreset ? String(current) : "custom");
              dd.onChange(async (v) => {
                if (v === "custom") return;
                this.plugin.settings.startupDelaySeconds = Number(v);
                await this.plugin.saveSettings();
                this.display();
              });
            });
          if (!delayPresets.includes(this.plugin.settings.startupDelaySeconds)) {
            new Setting(sub)
              .setName(this.t("customDelay"))
              .addText((t) =>
                t
                  .setValue(String(this.plugin.settings.startupDelaySeconds))
                  .setPlaceholder("0")
                  .onChange(async (v) => {
                    this.plugin.settings.startupDelaySeconds = Math.max(0, Number(v) || 0);
                    await this.plugin.saveSettings();
                  }),
              );
          }
        }
      });
    });

    this.renderSection(this.t("sectionCheckbox"), false, (section) => this.renderStatusSettings(section));

    this.renderSection(this.t("sectionCalendar"), false, (section) => {
      new Setting(section)
        .setName(this.t("calendarRibbonButton"))
        .setDesc(this.t("calendarRibbonDesc"))
        .addToggle(t =>
          t.setValue(this.plugin.settings.calendarShowRibbonButton).onChange(async (value) => {
            this.plugin.settings.calendarShowRibbonButton = value;
            await this.plugin.saveSettings();
            this.plugin.updateCalendarRibbon();
          })
        );
      new Setting(section).setName(this.t("calendarFirstDayOfWeek")).addText(t => 
         t.setValue(String(this.plugin.settings.calendarFirstDayOfWeek)).onChange(async v => {
            this.plugin.settings.calendarFirstDayOfWeek = Number(v) as 0|1;
            await this.plugin.saveSettings();
         })
      );
      this.addToggle(section, "calendarShowWeekNumber", this.t("calendarShowWeekNumber"));
      this.addToggle(section, "calendarOpenInNewLeaf", this.t("calendarOpenInNewLeaf"));
      this.addToggle(section, "calendarConfirmCreate", this.t("calendarConfirmCreateLabel"));
    });

    this.renderSection(this.t("sectionFrontmatter"), false, (section) => {
      this.addToggle(section, "frontmatterEnabled", this.t("frontmatterEnabled"));

      this.renderSubSection(section, this.t("sectionSettings"), (sub) => {
        this.addText(sub, this.t("frontmatterCreatedKey"), "", "frontmatterCreatedKey");
        this.addText(sub, this.t("frontmatterUpdatedKey"), "", "frontmatterUpdatedKey");
        this.addText(sub, this.t("frontmatterDateFormat"), "", "frontmatterDateFormat");
        new Setting(sub).setName(this.t("frontmatterIgnoredPaths")).setDesc(this.t("onePathPerLine")).addTextArea(t => 
           t.setValue(this.plugin.settings.frontmatterIgnoredPaths.join("\n")).onChange(async v => {
              this.plugin.settings.frontmatterIgnoredPaths = v.split("\n").map(s => s.trim()).filter(s => s);
              await this.plugin.saveSettings();
           })
        );
      });
    });

    this.renderSection(this.t("sectionAdvanced"), false, (section) => {
      this.renderLoggingSubSection(section);
    });
  }

  private renderLoggingSubSection(parent: HTMLElement): void {
    const details = parent.createEl("details", { cls: "cascade-settings-section cascade-settings-subsection" });
    details.open = this.openSections!.has(this.t("sectionInternalLog"));
    details.addEventListener("toggle", () => {
      if (details.open) {
        this.openSections!.add(this.t("sectionInternalLog"));
      } else {
        this.openSections!.delete(this.t("sectionInternalLog"));
      }
    });
    details.createEl("summary", { text: this.t("sectionInternalLog") });
    const content = details.createDiv({ cls: "cascade-settings-section__content" });

    new Setting(content)
      .setName(this.t("loggingEnabled"))
      .setDesc(this.t("loggingDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.loggingEnabled).onChange(async (value) => {
          this.plugin.settings.loggingEnabled = value;
          await this.plugin.saveSettings();
          this.display();
        }),
      );

    if (this.plugin.settings.loggingEnabled) {
      new Setting(content)
        .setName(this.t("loggingFolder"))
        .setDesc(this.t("loggingFolderDesc"))
        .addText((text) =>
          text
            .setPlaceholder(this.t("loggingFolderPlaceholder"))
            .setValue(this.plugin.settings.loggingFolder)
            .onChange(async (value) => {
              this.plugin.settings.loggingFolder = value.trim();
              await this.plugin.saveSettings();
            }),
        );

      new Setting(content)
        .setName(this.t("loggingFilename"))
        .setDesc(this.t("loggingFilenameDesc"))
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
        .setName(this.t("loggingRetentionDays"))
        .setDesc(this.t("loggingRetentionDesc"))
        .addText((text) =>
          text
            .setValue(String(this.plugin.settings.loggingRetentionDays))
            .onChange(async (value) => {
              this.plugin.settings.loggingRetentionDays = Number(value) || 0;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(content).setName(this.t("sectionCategories")).setDesc(this.t("loggingDesc")).setHeading();

      this.addToggle(content, "loggingStartup", this.t("loggingStartup"));
      this.addToggle(content, "loggingMigration", this.t("loggingMigration"));
      this.addToggle(content, "loggingNormalizer", this.t("loggingNormalization"));
      this.addToggle(content, "loggingErrors", this.t("loggingErrors"));
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

  private renderSubSection(parent: HTMLElement, title: string, render: (container: HTMLElement) => void): void {
    const details = parent.createEl("details", { cls: "cascade-settings-section cascade-settings-subsection" });
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
    new Setting(parent).setName(this.t("statusDefault")).setDesc(this.t("statusDefaultDesc"));
    for (const status of this.plugin.settings.essentialStatuses) {
      const setting = new Setting(parent)
        .setName(status.label)
        .setDesc(`Snippet [${status.symbol}]`);
      setting.nameEl.prepend(this.renderCheckboxSnippet(status.symbol));
      
      const badge = document.createElement("span");
      badge.textContent = this.t("statusDefaultBadge");
      badge.addClass("cascade-status-preview__lock");
      badge.style.marginLeft = "8px";
      setting.nameEl.appendChild(badge);
    }

    new Setting(parent).setName(this.t("statusAccessory")).setDesc(this.t("statusAccessoryDesc"));
    for (const [index, status] of this.plugin.settings.customStatuses.entries()) {
      const setting = new Setting(parent)
        .setName(status.label || this.t("statusUnnamed"))
        .setDesc(`Snippet [${status.symbol}]`)
        .addToggle((toggle) =>
          toggle.setValue(status.showInMenu !== false).onChange(async (value) => {
            this.plugin.settings.customStatuses[index] = { ...status, showInMenu: value };
            await this.plugin.saveSettings();
          }),
        )
        .addButton((button) =>
          button.setIcon("trash").setTooltip(this.t("removeStatus")).onClick(async () => {
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
      .setName(this.t("addAccessoryStatus"))
      .addText((text) => text.setPlaceholder(this.t("placeholderSymbol")).onChange((value) => (newSymbol = value)))
      .addText((text) => text.setPlaceholder(this.t("placeholderName")).onChange((value) => (newLabel = value)))
      .addText((text) => text.setPlaceholder(this.t("placeholderIcon")).onChange((value) => (newIcon = value)))
      .addButton((button) =>
        button.setButtonText(this.t("add")).onClick(async () => {
          const symbol = newSymbol.trim();
          const label = newLabel.trim();
          const icon = newIcon.trim();
          if (!symbol || symbol.length !== 1 || !label) {
            new Notice(this.t("enterSymbolAndName"));
            return;
          }
          if (this.plugin.settings.essentialStatuses.some((item) => item.symbol === symbol) || this.plugin.settings.customStatuses.some((item) => item.symbol === symbol)) {
            new Notice(this.t("symbolExists"));
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
