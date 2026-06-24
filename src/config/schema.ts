export type CascadeLanguage = "pt-BR" | "en-US" | "auto";
export type StartupWaitCondition = "fixed" | "until-daily" | "until-vault-idle" | "combined";
export type NormalizerCase = "none" | "uppercase" | "lowercase" | "title";

export interface NormalizerReplacement {
  from: string;
  to: string;
}

export interface StatusDef {
  symbol: string;
  label: string;
  icon?: string;
  essential: boolean;
  showInMenu?: boolean;
}

export interface FolderTemplate {
  folder: string;
  template: string;
}

export interface CascadeSettings {
  language: CascadeLanguage;
  startCascadeOnStartup: boolean;

  agendaRoot: string;
  openAnnualOnStartup: boolean;
  openMonthlyOnStartup: boolean;
  openWeeklyOnStartup: boolean;
  openDailyOnStartup: boolean;
  
  dailyFormat: string;
  dailyTemplate: string;
  dailyFolder: string;

  weeklyEnabled: boolean;
  weeklyFormat: string;
  weeklyTemplate: string;
  weeklyFolder: string;

  monthlyEnabled: boolean;
  monthlyFormat: string;
  monthlyTemplate: string;
  monthlyFolder: string;

  yearlyEnabled: boolean;
  yearlyFormat: string;
  yearlyTemplate: string;
  yearlyFolder: string;
  operationalYearStartMonth: number;

  runMigrationOnStartup: boolean;
  runMigrationOnManualOpen: boolean;

  normalizerEnabled: boolean;
  runNormalizerOnStartup: boolean;
  normalizeDelaySeconds: number;
  normalizerCase: NormalizerCase;
  normalizerAccents: boolean;
  normalizerReplacements: NormalizerReplacement[];
  addTimestamp: boolean;
  normalizerScopes: string[];
  normalizerIgnored: string[];

  migrationEnabled: boolean;
  recurringTasksPath: string;
  taskSetCreatedDate: boolean;
  taskSetDoneDate: boolean;
  cancelExpiredScheduled: boolean;
  previousDayMigrationLookbackDays: number;
  autoCompleteTaskFamilies: boolean;
  taskGlobalFilter: string;

  essentialStatuses: StatusDef[];
  customStatuses: StatusDef[];

  calendarFirstDayOfWeek: 0 | 1;
  calendarShowWeekNumber: boolean;
  calendarShowRibbonButton: boolean;
  calendarOpenInNewLeaf: boolean;
  calendarConfirmCreate: boolean;

  frontmatterEnabled: boolean;
  frontmatterCreatedKey: string;
  frontmatterUpdatedKey: string;
  frontmatterDateFormat: string;
  frontmatterIgnoredPaths: string[];

  loggingEnabled: boolean;
  loggingFolder: string;
  loggingFilename: string;
  loggingRetentionDays: number;
  loggingStartup: boolean;
  loggingMigration: boolean;
  loggingNormalizer: boolean;
  loggingErrors: boolean;

  // Legacy/Internal
  startupWaitCondition: StartupWaitCondition;
  startupWaitMaxSeconds: number;
  startupVaultIdleSeconds: number;
  templatesFolder: string;
  folderTemplates: FolderTemplate[];
}
