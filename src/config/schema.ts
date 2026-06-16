export type CascadeLanguage = "pt-BR" | "en-US" | "auto";
export type StartupWaitCondition = "fixed" | "until-daily" | "until-vault-idle" | "combined";
export type WeeklyStructure = "folder-index" | "flat";

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
  agendaRoot: string;
  openTodayOnStartup: boolean;
  runMigrationOnStartup: boolean;
  runMigrationOnManualOpen: boolean;
  runNormalizerOnStartup: boolean;
  startupDelaySeconds: number;
  startupWaitCondition: StartupWaitCondition;
  startupWaitMaxSeconds: number;
  startupVaultIdleSeconds: number;
  dailyEnabled: boolean;
  weeklyEnabled: boolean;
  weeklyStructure: WeeklyStructure;
  monthlyEnabled: boolean;
  yearlyEnabled: boolean;
  operationalYearStartMonth: number;
  dailyFormat: string;
  weeklyFormat: string;
  monthlyFormat: string;
  yearlyFormat: string;
  noteFormat: string;
  normalizerEnabled: boolean;
  normalizerUppercase: boolean;
  normalizerAccents: boolean;
  normalizerTimestamp: boolean;
  normalizerScopes: string[];
  normalizerIgnored: string[];
  templatesFolder: string;
  dailyTemplate: string;
  weeklyTemplate: string;
  monthlyTemplate: string;
  yearlyTemplate: string;
  folderTemplates: FolderTemplate[];
  recurringTasksPath: string;
  taskGlobalFilter: string;
  taskSetCreatedDate: boolean;
  taskSetDoneDate: boolean;
  migrationEnabled: boolean;
  cancelExpiredScheduled: boolean;
  previousDayMigrationLookbackDays: number;
  autoCompleteTaskFamilies: boolean;
  essentialStatuses: StatusDef[];
  customStatuses: StatusDef[];
  calendarFirstDayOfWeek: 0 | 1;
  calendarShowWeekNumbers: boolean;
  calendarOpenInNewLeaf: boolean;
  calendarConfirmCreate: boolean;
  frontmatterEnabled: boolean;
  frontmatterCreatedKey: string;
  frontmatterUpdatedKey: string;
  frontmatterDateFormat: string;
  frontmatterIgnoredPaths: string[];
}
