import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type CascadePlugin from "../main";

type SectionId =
  | "general"
  | "agenda"
  | "migration"
  | "normalization"
  | "tasks"
  | "checkbox"
  | "calendar"
  | "frontmatter"
  | "advanced";

const SECTIONS: { id: SectionId; icon: string; labelKey: string }[] = [
  { id: "general", icon: "⚙️", labelKey: "sectionGeneral" },
  { id: "agenda", icon: "📅", labelKey: "sectionAgenda" },
  { id: "migration", icon: "🔄", labelKey: "sectionMigration" },
  { id: "normalization", icon: "📝", labelKey: "sectionNormalization" },
  { id: "tasks", icon: "✅", labelKey: "sectionTasks" },
  { id: "checkbox", icon: "🏷️", labelKey: "sectionCheckbox" },
  { id: "calendar", icon: "📆", labelKey: "sectionCalendar" },
  { id: "frontmatter", icon: "📄", labelKey: "sectionFrontmatter" },
  { id: "advanced", icon: "📊", labelKey: "sectionAdvanced" },
];

export class CascadeSettingTab extends PluginSettingTab {
  private activeSection: SectionId = "general";
  private searchQuery = "";
  private searchInput: HTMLInputElement | null = null;
  private savedIndicator: HTMLElement | null = null;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;
  private navContainer: HTMLElement | null = null;
  private contentContainer: HTMLElement | null = null;

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
    const { containerEl } = this;
    containerEl.empty();

    this.renderHeader(containerEl);
    this.navContainer = containerEl.createDiv({ cls: "cascade-settings-nav" });
    this.renderNav();
    this.contentContainer = containerEl.createDiv({ cls: "cascade-settings-section-v2" });
    this.renderSection(this.activeSection);
  }

  /* ============================================
     HEADER
     ============================================ */

  private renderHeader(parent: HTMLElement): void {
    const header = parent.createDiv({ cls: "cascade-settings-header" });

    const titleRow = header.createDiv({ cls: "cascade-settings-header__actions" });
    titleRow.createEl("h2", { text: "Cascade" });

    this.savedIndicator = titleRow.createSpan({
      cls: "cascade-settings-saved",
      text: `✓ ${this.t("settingsSaved")}`,
    });

    const btnRow = header.createDiv({ cls: "cascade-settings-header__actions" });

    this.searchInput = header.createEl("input", {
      cls: "cascade-settings-search",
      attr: { type: "text", placeholder: this.t("settingsSearchPlaceholder") },
    });
    this.searchInput.addEventListener("input", () => {
      this.searchQuery = this.searchInput?.value.toLowerCase() ?? "";
      this.renderSection(this.activeSection);
    });

    new Setting(btnRow)
      .addButton((btn) =>
        btn
          .setButtonText(this.t("settingsExport"))
          .setCta()
          .onClick(() => this.exportSettings()),
      )
      .addButton((btn) =>
        btn
          .setButtonText(this.t("settingsImport"))
          .onClick(() => this.importSettings()),
      )
      .addButton((btn) =>
        btn
          .setButtonText(this.t("settingsResetAll"))
          .setWarning()
          .onClick(() => this.resetAll()),
      );
  }

  /* ============================================
     NAVIGATION
     ============================================ */

  private isSectionVisible(id: SectionId): boolean {
    const s = this.plugin.settings;
    switch (id) {
      case "general": return true;
      case "agenda": return true;
      case "migration": return s.migrationEnabled;
      case "normalization": return s.normalizerEnabled;
      case "tasks": return s.migrationEnabled;
      case "checkbox": return true;
      case "calendar": return true;
      case "frontmatter": return s.frontmatterEnabled;
      case "advanced": return s.loggingEnabled;
    }
  }

  private renderNav(): void {
    if (!this.navContainer) return;
    if (!this.isSectionVisible(this.activeSection)) {
      this.activeSection = "general";
    }
    this.navContainer.empty();
    for (const section of SECTIONS) {
      if (!this.isSectionVisible(section.id)) continue;
      const btn = this.navContainer.createEl("button", {
        cls: `cascade-settings-nav__item${section.id === this.activeSection ? " is-active" : ""}`,
      });
      btn.createSpan({ cls: "cascade-settings-nav__icon", text: section.icon });
      btn.createSpan({ text: this.t(section.labelKey) });
      btn.addEventListener("click", () => {
        this.activeSection = section.id;
        this.renderNav();
        this.renderSection(section.id);
      });
    }
  }

  /* ============================================
     SECTION ROUTER
     ============================================ */

  private renderSection(id: SectionId): void {
    if (!this.contentContainer) return;
    this.contentContainer.empty();

    switch (id) {
      case "general":
        this.renderGeneralSection(this.contentContainer);
        break;
      case "agenda":
        this.renderAgendaSection(this.contentContainer);
        break;
      case "migration":
        this.renderMigrationSection(this.contentContainer);
        break;
      case "normalization":
        this.renderNormalizationSection(this.contentContainer);
        break;
      case "tasks":
        this.renderTasksSection(this.contentContainer);
        break;
      case "checkbox":
        this.renderCheckboxSection(this.contentContainer);
        break;
      case "calendar":
        this.renderCalendarSection(this.contentContainer);
        break;
      case "frontmatter":
        this.renderFrontmatterSection(this.contentContainer);
        break;
      case "advanced":
        this.renderAdvancedSection(this.contentContainer);
        break;
    }
  }

  /* ============================================
     GENERAL
     ============================================ */

  private renderGeneralSection(parent: HTMLElement): void {
    this.renderCard(parent, "⚙️", this.t("sectionGeneral"), () => {
      this.addTooltipedSetting(
        "language",
        this.t("language"),
        this.t("tooltipLanguage"),
        (setting) => {
          setting.addDropdown((dropdown) => {
            dropdown
              .addOption("auto", "Auto")
              .addOption("pt-BR", "pt-BR")
              .addOption("en-US", "en-US")
              .setValue(this.plugin.settings.language)
              .onChange(async (value) => {
                this.plugin.settings.language = value as any;
                await this.plugin.saveSettings();
                this.showSaved();
                this.display();
              });
          });
        },
      );

      this.addTooltipedSetting(
        "startCascadeOnStartup",
        this.t("startCascadeOnStartup"),
        this.t("tooltipStartOnStartup"),
        (setting) => {
          setting.addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.startCascadeOnStartup).onChange(async (value) => {
              this.plugin.settings.startCascadeOnStartup = value;
              await this.plugin.saveSettings();
              this.showSaved();
              this.display();
            }),
          );
        },
      );

      if (!this.plugin.settings.startCascadeOnStartup) {
        this.addSetting("manualStart", this.t("manualStart"), this.t("manualStartDesc"), (setting) => {
          setting.addButton((button) => {
            button.setButtonText(this.t("startCascadeButton")).onClick(() => {
              // @ts-ignore
              this.app.commands.executeCommandById("obsidian-cascade:start-cascade");
            });
          });
        });
      }
    });

    this.renderCard(parent, "📅", this.t("sectionAgenda"), () => {
      this.renderOpenOnStartupDropdown(this.contentContainer!);

      this.addTooltipedSetting(
        "agendaRoot",
        this.t("agendaRoot"),
        this.t("tooltipAgendaRoot"),
        (setting) => {
          setting.addText((text) =>
            text.setValue(this.plugin.settings.agendaRoot).onChange(async (value) => {
              this.plugin.settings.agendaRoot = value.trim();
              await this.plugin.saveSettings();
              this.showSaved();
            }),
          );
        },
      );
    });

    this.renderCard(parent, "🎛️", this.t("sectionFeatures"), () => {
      this.addTooltipedToggle("yearlyEnabled", this.t("yearlyEnabled"), this.t("tooltipYearlyEnabled"));
      this.addTooltipedToggle("monthlyEnabled", this.t("monthlyEnabled"), this.t("tooltipMonthlyEnabled"));
      this.addTooltipedToggle("weeklyEnabled", this.t("weeklyEnabled"), this.t("tooltipWeeklyEnabled"));
      this.addTooltipedToggle("normalizerEnabled", this.t("normalizerEnabled"), this.t("tooltipNormalizerEnabled"));
      this.addTooltipedToggle("migrationEnabled", this.t("migrationEnabled"), this.t("tooltipMigrationEnabled"));
      this.addTooltipedToggle("frontmatterEnabled", this.t("frontmatterEnabled"), this.t("tooltipFrontmatterEnabled"));
      this.addTooltipedToggle("loggingEnabled", this.t("loggingEnabled"), this.t("tooltipLoggingEnabled"));
    });
  }

  /* ============================================
     AGENDA
     ============================================ */

  private renderAgendaSection(parent: HTMLElement): void {
    this.renderCard(parent, "📅", this.t("sectionAgenda"), () => {
      this.addTooltipedSetting(
        "agendaRoot",
        this.t("agendaRoot"),
        this.t("tooltipAgendaRoot"),
        (setting) => {
          setting.addText((text) =>
            text.setValue(this.plugin.settings.agendaRoot).onChange(async (value) => {
              this.plugin.settings.agendaRoot = value.trim();
              await this.plugin.saveSettings();
              this.showSaved();
            }),
          );
        },
      );
    });

    this.renderCard(parent, "📆", this.t("sectionAnnual"), () => {
      if (this.plugin.settings.yearlyEnabled) {
        this.addText(parent, "yearlyFormat", "", "yearlyFormat");
        this.addText(parent, "yearlyTemplate", "", "yearlyTemplate");
        this.addText(parent, "yearlyFolder", "", "yearlyFolder");
        this.addText(parent, "operationalYearStartMonth", "", "operationalYearStartMonth");
      }
    });

    this.renderCard(parent, "📅", this.t("sectionMonthly"), () => {
      if (this.plugin.settings.monthlyEnabled) {
        this.addText(parent, "monthlyFormat", "", "monthlyFormat");
        this.addText(parent, "monthlyTemplate", "", "monthlyTemplate");
        this.addText(parent, "monthlyFolder", "", "monthlyFolder");
      }
    });

    this.renderCard(parent, "📋", this.t("sectionWeekly"), () => {
      if (this.plugin.settings.weeklyEnabled) {
        this.addText(parent, "weeklyFormat", "", "weeklyFormat");
        this.addText(parent, "weeklyTemplate", "", "weeklyTemplate");
        this.addText(parent, "weeklyFolder", "", "weeklyFolder");
      }
    });

    this.renderCard(parent, "📝", this.t("sectionDaily"), () => {
      this.addTooltipedSetting(
        "dailyFormat",
        this.t("dailyFormat"),
        this.t("tooltipDailyFormat"),
        (setting) => {
          setting.addText((text) =>
            text.setValue(this.plugin.settings.dailyFormat).onChange(async (value) => {
              this.plugin.settings.dailyFormat = value.trim();
              await this.plugin.saveSettings();
              this.showSaved();
            }),
          );
        },
      );
      this.addTooltipedSetting(
        "dailyTemplate",
        this.t("dailyTemplate"),
        this.t("tooltipDailyTemplate"),
        (setting) => {
          setting.addText((text) =>
            text.setValue(this.plugin.settings.dailyTemplate).onChange(async (value) => {
              this.plugin.settings.dailyTemplate = value.trim();
              await this.plugin.saveSettings();
              this.showSaved();
            }),
          );
        },
      );
      this.addTooltipedSetting(
        "dailyFolder",
        this.t("dailyFolder"),
        this.t("tooltipDailyFolder"),
        (setting) => {
          setting.addText((text) =>
            text.setValue(this.plugin.settings.dailyFolder).onChange(async (value) => {
              this.plugin.settings.dailyFolder = value.trim();
              await this.plugin.saveSettings();
              this.showSaved();
            }),
          );
        },
      );
    });
  }

  /* ============================================
     MIGRATION
     ============================================ */

  private renderMigrationSection(parent: HTMLElement): void {
    this.renderCard(parent, "🔄", this.t("sectionMigration"), () => {
      this.addToggle(parent, "runMigrationOnStartup", this.t("runMigrationOnStartup"));
      this.addToggle(parent, "runMigrationOnManualOpen", this.t("runMigrationOnManualOpen"));
    });
  }

  /* ============================================
     NORMALIZATION
     ============================================ */

  private renderNormalizationSection(parent: HTMLElement): void {
    this.renderCard(parent, "📝", this.t("sectionNormalization"), () => {
      if (this.plugin.settings.normalizerEnabled) {
        this.addTooltipedToggle(
          "runNormalizerOnStartup",
          this.t("runNormalizerOnStartup"),
          this.t("tooltipRunOnStartup"),
        );
        if (!this.plugin.settings.runNormalizerOnStartup) {
          this.addText(parent, "normalizeDelaySeconds", "", "normalizeDelaySeconds");
        }
      }

      this.addTooltipedSetting(
        "normalizerCase",
        this.t("normalizerCase"),
        this.t("tooltipNormalizerCase"),
        (setting) => {
          setting.addDropdown((d) =>
            d
              .addOption("none", this.t("normalizerCaseNone"))
              .addOption("uppercase", this.t("normalizerCaseUppercase"))
              .addOption("lowercase", this.t("normalizerCaseLowercase"))
              .addOption("title", this.t("normalizerCaseTitle"))
              .addOption("slug", this.t("normalizerCaseSlug"))
              .addOption("sentence", this.t("normalizerCaseSentence"))
              .addOption("camelCase", this.t("normalizerCaseCamel"))
              .addOption("PascalCase", this.t("normalizerCasePascal"))
              .addOption("snake_case", this.t("normalizerCaseSnake"))
              .setValue(this.plugin.settings.normalizerCase)
              .onChange(async (v) => {
                this.plugin.settings.normalizerCase = v as any;
                await this.plugin.saveSettings();
                this.showSaved();
              }),
          );
        },
      );

      this.addTooltipedToggle("normalizerAccents", this.t("normalizerAccents"), this.t("tooltipNormalizerAccents"));
      this.addTooltipedToggle("addTimestamp", this.t("addTimestamp"), this.t("tooltipAddTimestamp"));

      this.addSetting("normalizerScopes", this.t("normalizerScopes"), this.t("onePathPerLine"), (setting) => {
        setting.addTextArea((t) =>
          t.setValue(this.plugin.settings.normalizerScopes.join("\n")).onChange(async (v) => {
            this.plugin.settings.normalizerScopes = v.split("\n").map((s) => s.trim()).filter((s) => s);
            await this.plugin.saveSettings();
            this.showSaved();
          }),
        );
      });

      this.addSetting("ignoredPaths", this.t("normalizerIgnored"), this.t("onePathPerLine"), (setting) => {
        setting.addTextArea((t) =>
          t.setValue(this.plugin.settings.ignoredPaths.join("\n")).onChange(async (v) => {
            this.plugin.settings.ignoredPaths = v.split("\n").map((s) => s.trim()).filter((s) => s);
            await this.plugin.saveSettings();
            this.showSaved();
          }),
        );
      });
    });

    this.renderCard(parent, "🔄", this.t("sectionReplacements"), () => {
      this.renderReplacements(parent);
    });
  }

  /* ============================================
     TASKS
     ============================================ */

  private renderTasksSection(parent: HTMLElement): void {
    this.renderCard(parent, "✅", this.t("sectionTasks"), () => {
      if (this.plugin.settings.migrationEnabled) {
        this.addText(parent, "recurringTasksPathLabel", "", "recurringTasksPath");
        this.addTooltipedToggle("taskSetCreatedDate", this.t("taskSetCreatedDate"), this.t("tooltipTaskSetCreated"));
        this.addTooltipedToggle("taskSetDoneDate", this.t("taskSetDoneDate"), this.t("tooltipTaskSetDone"));
        this.addToggle(parent, "cancelExpiredScheduled", this.t("cancelExpiredScheduledLabel"));
        this.addText(parent, "previousDayMigrationLookback", "", "previousDayMigrationLookbackDays");
        this.addToggle(parent, "autoCompleteTaskFamilies", this.t("autoCompleteTaskFamilies"));
        this.addText(parent, "taskGlobalFilter", "", "taskGlobalFilter");

        this.addStartupDelay(parent);
      }
    });
  }

  /* ============================================
     CHECKBOX / STATUS
     ============================================ */

  private renderCheckboxSection(parent: HTMLElement): void {
    this.renderCard(parent, "🏷️", this.t("sectionCheckbox"), () => {
      this.renderStatusSettings(parent);
    });
  }

  /* ============================================
     CALENDAR
     ============================================ */

  private renderCalendarSection(parent: HTMLElement): void {
    this.renderCard(parent, "📆", this.t("sectionCalendar"), () => {
      this.addTooltipedSetting(
        "calendarShowRibbonButton",
        this.t("calendarRibbonButton"),
        this.t("tooltipCalendarRibbon"),
        (setting) => {
          setting.addToggle((t) =>
            t.setValue(this.plugin.settings.calendarShowRibbonButton).onChange(async (value) => {
              this.plugin.settings.calendarShowRibbonButton = value;
              await this.plugin.saveSettings();
              this.showSaved();
              this.plugin.updateCalendarRibbon();
            }),
          );
        },
      );

      this.addSetting("calendarFirstDayOfWeek", this.t("calendarFirstDayOfWeek"), "", (setting) => {
        setting.addDropdown((d) =>
          d
            .addOption("0", this.t("calendarWeekdays").split(",")[0])
            .addOption("1", this.t("calendarWeekdays").split(",")[1])
            .setValue(String(this.plugin.settings.calendarFirstDayOfWeek))
            .onChange(async (v) => {
              this.plugin.settings.calendarFirstDayOfWeek = Number(v) as 0 | 1;
              await this.plugin.saveSettings();
              this.showSaved();
            }),
        );
      });

      this.addTooltipedToggle("calendarShowWeekNumber", this.t("calendarShowWeekNumber"), this.t("tooltipCalendarWeekNumber"));
      this.addTooltipedToggle("calendarOpenInNewLeaf", this.t("calendarOpenInNewLeaf"), this.t("tooltipCalendarOpenNew"));
      this.addTooltipedToggle("calendarConfirmCreate", this.t("calendarConfirmCreateLabel"), this.t("tooltipCalendarConfirm"));
    });
  }

  /* ============================================
     FRONTMATTER
     ============================================ */

  private renderFrontmatterSection(parent: HTMLElement): void {
    this.renderCard(parent, "📄", this.t("sectionFrontmatter"), () => {
      if (this.plugin.settings.frontmatterEnabled) {
        this.addTooltipedSetting(
          "frontmatterCreatedKey",
          this.t("frontmatterCreatedKey"),
          this.t("tooltipFrontmatterCreatedKey"),
          (setting) => {
            setting.addText((text) =>
              text.setValue(this.plugin.settings.frontmatterCreatedKey).onChange(async (value) => {
                this.plugin.settings.frontmatterCreatedKey = value.trim();
                await this.plugin.saveSettings();
                this.showSaved();
              }),
            );
          },
        );

        this.addTooltipedSetting(
          "frontmatterUpdatedKey",
          this.t("frontmatterUpdatedKey"),
          this.t("tooltipFrontmatterUpdatedKey"),
          (setting) => {
            setting.addText((text) =>
              text.setValue(this.plugin.settings.frontmatterUpdatedKey).onChange(async (value) => {
                this.plugin.settings.frontmatterUpdatedKey = value.trim();
                await this.plugin.saveSettings();
                this.showSaved();
              }),
            );
          },
        );

        this.addTooltipedSetting(
          "frontmatterDateFormat",
          this.t("frontmatterDateFormat"),
          this.t("tooltipFrontmatterDateFormat"),
          (setting) => {
            setting.addText((text) =>
              text.setValue(this.plugin.settings.frontmatterDateFormat).onChange(async (value) => {
                this.plugin.settings.frontmatterDateFormat = value.trim();
                await this.plugin.saveSettings();
                this.showSaved();
              }),
            );
          },
        );
      }
    });
  }

  /* ============================================
     ADVANCED / LOGGING
     ============================================ */

  private renderAdvancedSection(parent: HTMLElement): void {
    this.renderCard(parent, "📊", this.t("sectionInternalLog"), () => {
      if (this.plugin.settings.loggingEnabled) {
        this.addSetting("loggingFolder", this.t("loggingFolder"), this.t("loggingFolderDesc"), (setting) => {
          setting.addText((text) =>
            text
              .setPlaceholder(this.t("loggingFolderPlaceholder"))
              .setValue(this.plugin.settings.loggingFolder)
              .onChange(async (value) => {
                this.plugin.settings.loggingFolder = value.trim();
                await this.plugin.saveSettings();
                this.showSaved();
              }),
          );
        });

        this.addSetting("loggingFilename", this.t("loggingFilename"), this.t("loggingFilenameDesc"), (setting) => {
          setting.addText((text) =>
            text
              .setPlaceholder("cascade-log.md")
              .setValue(this.plugin.settings.loggingFilename)
              .onChange(async (value) => {
                this.plugin.settings.loggingFilename = value.trim() || "cascade-log.md";
                await this.plugin.saveSettings();
                this.showSaved();
              }),
          );
        });

        this.addTooltipedSetting(
          "loggingRetentionDays",
          this.t("loggingRetentionDays"),
          this.t("tooltipLogRetention"),
          (setting) => {
            setting.addText((text) =>
              text.setValue(String(this.plugin.settings.loggingRetentionDays)).onChange(async (value) => {
                this.plugin.settings.loggingRetentionDays = Number(value) || 0;
                await this.plugin.saveSettings();
                this.showSaved();
              }),
            );
          },
        );

        this.addToggle(parent, "loggingStartup", this.t("loggingStartup"));
        this.addToggle(parent, "loggingMigration", this.t("loggingMigration"));
        this.addToggle(parent, "loggingNormalizer", this.t("loggingNormalization"));
        this.addToggle(parent, "loggingErrors", this.t("loggingErrors"));
      }
    });
  }

  /* ============================================
     OPEN ON STARTUP DROPDOWN
     ============================================ */

  private renderOpenOnStartupDropdown(parent: HTMLElement): void {
    const options = [
      { key: "none" as const, label: "None" },
      { key: "openAnnualOnStartup" as const, label: this.t("sectionAnnual") },
      { key: "openMonthlyOnStartup" as const, label: this.t("sectionMonthly") },
      { key: "openWeeklyOnStartup" as const, label: this.t("sectionWeekly") },
      { key: "openDailyOnStartup" as const, label: this.t("sectionDaily") },
    ];

    const activeKey = options.slice(1).find((o) => this.plugin.settings[o.key as keyof typeof this.plugin.settings])?.key ?? "openDailyOnStartup";
    const activeLabel = options.find((o) => o.key === activeKey)?.label ?? "Daily";

    const setting = new Setting(parent).setName(this.t("openOnStartup")).setDesc(activeLabel);
    setting.addDropdown((dropdown) => {
      for (const opt of options) {
        dropdown.addOption(opt.key, opt.label);
      }
      dropdown.setValue(activeKey);
      dropdown.onChange(async (value) => {
        this.plugin.settings.openAnnualOnStartup = false;
        this.plugin.settings.openMonthlyOnStartup = false;
        this.plugin.settings.openWeeklyOnStartup = false;
        this.plugin.settings.openDailyOnStartup = false;
        if (value !== "none") {
          (this.plugin.settings as any)[value] = true;
        }
        await this.plugin.saveSettings();
        this.showSaved();
        this.display();
      });
    });
  }

  /* ============================================
     REUSABLE COMPONENTS
     ============================================ */

  private renderCard(
    parent: HTMLElement,
    icon: string,
    title: string,
    render: () => void,
    onReset?: () => void,
  ): void {
    const card = parent.createDiv({ cls: "cascade-card" });
    const header = card.createDiv({ cls: "cascade-card__header" });
    header.createSpan({ cls: "cascade-card__icon", text: icon });
    header.createSpan({ cls: "cascade-card__title", text: title });

    if (onReset) {
      const resetBtn = header.createEl("button", {
        cls: "cascade-card__reset",
        text: this.t("settingsResetSection"),
      });
      resetBtn.addEventListener("click", () => {
        onReset();
        this.display();
      });
    }

    const body = card.createDiv({ cls: "cascade-card__body" });
    const prev = this.contentContainer;
    this.contentContainer = body;
    render();
    this.contentContainer = prev;
  }

  private addTooltipedSetting(
    key: string,
    name: string,
    tooltip: string,
    build: (setting: Setting) => void,
  ): void {
    const setting = new Setting(this.contentContainer!).setName(name);
    const tooltipEl = setting.nameEl.createSpan({ cls: "cascade-tooltip", text: "?" });
    tooltipEl.createSpan({ cls: "cascade-tooltip__content", text: tooltip });
    build(setting);
  }

  private addTooltipedToggle(
    key: keyof typeof this.plugin.settings,
    name: string,
    tooltip: string,
  ): void {
    const setting = new Setting(this.contentContainer!).setName(name);
    const tooltipEl = setting.nameEl.createSpan({ cls: "cascade-tooltip", text: "?" });
    tooltipEl.createSpan({ cls: "cascade-tooltip__content", text: tooltip });
    setting.addToggle((toggle) =>
      toggle.setValue(this.plugin.settings[key] as boolean).onChange(async (value) => {
        (this.plugin.settings as any)[key] = value;
        await this.plugin.saveSettings();
        this.showSaved();
        this.display();
      }),
    );
  }

  private addSetting(name: string, desc: string, _desc: string, build: (setting: Setting) => void): void {
    const setting = new Setting(this.contentContainer!).setName(name).setDesc(desc);
    build(setting);
  }

  private addToggle(parent: HTMLElement, key: keyof typeof this.plugin.settings, name: string): void {
    new Setting(this.contentContainer!)
      .setName(name)
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings[key] as boolean).onChange(async (value) => {
          (this.plugin.settings as any)[key] = value;
          await this.plugin.saveSettings();
          this.showSaved();
        }),
      );
  }

  private addText(parent: HTMLElement, name: string, desc: string, key: keyof typeof this.plugin.settings): void {
    new Setting(this.contentContainer!)
      .setName(name)
      .setDesc(desc)
      .addText((text) =>
        text.setValue(String(this.plugin.settings[key] ?? "")).onChange(async (value) => {
          (this.plugin.settings as any)[key] = value.trim();
          await this.plugin.saveSettings();
          this.showSaved();
        }),
      );
  }

  /* ============================================
     REPLACEMENTS
     ============================================ */

  private renderReplacements(_parent: HTMLElement): void {
    const container = this.contentContainer!.createDiv({ cls: "cascade-replacements" });
    const list = this.plugin.settings.normalizerReplacements;

    list.forEach((rep, index) => {
      const row = container.createDiv({ cls: "cascade-replacement-row" });
      const fromInput = row.createEl("input", {
        type: "text",
        attr: { placeholder: this.t("placeholderFrom"), value: rep.from, style: "width:80px" },
      });
      row.createSpan({ text: " \u2192 " });
      const toInput = row.createEl("input", {
        type: "text",
        attr: { placeholder: this.t("placeholderTo"), value: rep.to, style: "width:80px" },
      });

      const save = async (): Promise<void> => {
        list[index] = { from: fromInput.value, to: toInput.value };
        await this.plugin.saveSettings();
        this.showSaved();
      };
      fromInput.addEventListener("change", save);
      toInput.addEventListener("change", save);

      const removeBtn = row.createEl("button", {
        text: "\u2715",
        attr: { style: "margin-left:4px" },
      });
      removeBtn.addEventListener("click", async () => {
        this.plugin.settings.normalizerReplacements.splice(index, 1);
        await this.plugin.saveSettings();
        this.renderSection("normalization");
      });
    });

    const addBtn = container.createEl("button", {
      text: this.t("addReplacement"),
      attr: { style: "margin-top:4px;display:block" },
    });
    addBtn.addEventListener("click", async () => {
      this.plugin.settings.normalizerReplacements.push({ from: "", to: "" });
      await this.plugin.saveSettings();
      this.renderSection("normalization");
    });
  }

  /* ============================================
     STATUS SETTINGS
     ============================================ */

  private renderStatusSettings(_parent: HTMLElement): void {
    new Setting(this.contentContainer!).setName(this.t("statusDefault")).setDesc(this.t("statusDefaultDesc"));
    for (const status of this.plugin.settings.essentialStatuses) {
      const setting = new Setting(this.contentContainer!)
        .setName(status.label)
        .setDesc(`Snippet [${status.symbol}]`);
      setting.nameEl.prepend(this.renderCheckboxSnippet(status.symbol));

      const badge = document.createElement("span");
      badge.textContent = this.t("statusDefaultBadge");
      badge.addClass("cascade-status-preview__lock");
      badge.style.marginLeft = "8px";
      setting.nameEl.appendChild(badge);
    }

    new Setting(this.contentContainer!).setName(this.t("statusAccessory")).setDesc(this.t("statusAccessoryDesc"));
    for (const [index, status] of this.plugin.settings.customStatuses.entries()) {
      const setting = new Setting(this.contentContainer!)
        .setName(status.label || this.t("statusUnnamed"))
        .setDesc(`Snippet [${status.symbol}]`)
        .addToggle((toggle) =>
          toggle.setValue(status.showInMenu !== false).onChange(async (value) => {
            this.plugin.settings.customStatuses[index] = { ...status, showInMenu: value };
            await this.plugin.saveSettings();
            this.showSaved();
          }),
        )
        .addButton((button) =>
          button.setIcon("trash").setTooltip(this.t("removeStatus")).onClick(async () => {
            this.plugin.settings.customStatuses.splice(index, 1);
            await this.plugin.saveSettings();
            this.renderSection("checkbox");
          }),
        );
      setting.nameEl.prepend(this.renderCheckboxSnippet(status.symbol));
    }

    let newSymbol = "";
    let newLabel = "";
    let newIcon = "";
    new Setting(this.contentContainer!)
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
          if (
            this.plugin.settings.essentialStatuses.some((item) => item.symbol === symbol) ||
            this.plugin.settings.customStatuses.some((item) => item.symbol === symbol)
          ) {
            new Notice(this.t("symbolExists"));
            return;
          }
          this.plugin.settings.customStatuses.push({ symbol, label, icon, essential: false, showInMenu: true });
          await this.plugin.saveSettings();
          this.renderSection("checkbox");
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

  /* ============================================
     STARTUP DELAY
     ============================================ */

  private addStartupDelay(_parent: HTMLElement): void {
    const delayPresets = [0, 5, 10, 30];
    new Setting(this.contentContainer!)
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
          this.showSaved();
          this.display();
        });
      });
    if (!delayPresets.includes(this.plugin.settings.startupDelaySeconds)) {
      new Setting(this.contentContainer!)
        .setName(this.t("customDelay"))
        .addText((t) =>
          t
            .setValue(String(this.plugin.settings.startupDelaySeconds))
            .setPlaceholder("0")
            .onChange(async (v) => {
              this.plugin.settings.startupDelaySeconds = Math.max(0, Number(v) || 0);
              await this.plugin.saveSettings();
              this.showSaved();
            }),
        );
    }
  }

  /* ============================================
     IMPORT / EXPORT / RESET
     ============================================ */

  private exportSettings(): void {
    const data = JSON.stringify(this.plugin.settings, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cascade-settings.json";
    a.click();
    URL.revokeObjectURL(url);
    new Notice(this.t("settingsExportSuccess"));
  }

  private importSettings(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== "object" || !data.agendaRoot) {
          new Notice(this.t("settingsImportError"));
          return;
        }
        Object.assign(this.plugin.settings, data);
        await this.plugin.saveSettings();
        new Notice(this.t("settingsImportSuccess"));
        this.display();
      } catch {
        new Notice(this.t("settingsImportError"));
      }
    });
    input.click();
  }

  private async resetAll(): Promise<void> {
    const { DEFAULT_SETTINGS } = await import("./defaults");
    Object.assign(this.plugin.settings, structuredClone(DEFAULT_SETTINGS));
    await this.plugin.saveSettings();
    this.display();
  }

  /* ============================================
     UTILITIES
     ============================================ */

  private showSaved(): void {
    if (this.savedTimer) clearTimeout(this.savedTimer);
    this.savedIndicator?.addClass("is-visible");
    this.savedTimer = setTimeout(() => {
      this.savedIndicator?.removeClass("is-visible");
    }, 1500);
  }
}
