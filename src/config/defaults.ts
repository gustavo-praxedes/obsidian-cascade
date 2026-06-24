import type { CascadeSettings, StatusDef } from "./schema";

export const ESSENTIAL_STATUSES: StatusDef[] = [
  { symbol: " ", label: "To-do", essential: true },
  { symbol: "/", label: "Incomplete", essential: true },
  { symbol: "x", label: "Done", essential: true },
  { symbol: "-", label: "Cancelled", essential: true },
  { symbol: ">", label: "Forwarded", essential: true },
  { symbol: "<", label: "Scheduling", essential: true },
];

export const ACCESSORY_STATUSES: StatusDef[] = [
  { symbol: "?", label: "Question", essential: false, showInMenu: false },
  { symbol: "!", label: "Important", essential: false, showInMenu: false },
  { symbol: "*", label: "Star", essential: false, showInMenu: true },
  { symbol: '"', label: "Quote", essential: false, showInMenu: false },
  { symbol: "l", label: "Location", essential: false, showInMenu: false },
  { symbol: "b", label: "Bookmark", essential: false, showInMenu: true },
  { symbol: "i", label: "Information", essential: false, showInMenu: true },
  { symbol: "S", label: "Savings", essential: false, showInMenu: true },
  { symbol: "I", label: "Idea", essential: false, showInMenu: true },
  { symbol: "p", label: "Pro", essential: false, showInMenu: false },
  { symbol: "c", label: "Con", essential: false, showInMenu: false },
  { symbol: "f", label: "Fire", essential: false, showInMenu: false },
  { symbol: "k", label: "Key", essential: false, showInMenu: false },
  { symbol: "w", label: "Win", essential: false, showInMenu: false },
  { symbol: "u", label: "Up", essential: false, showInMenu: true },
  { symbol: "d", label: "Down", essential: false, showInMenu: true },
];

export const DEFAULT_SETTINGS: CascadeSettings = {
  language: "auto",
  startCascadeOnStartup: true,

  agendaRoot: "",
  openAnnualOnStartup: false,
  openMonthlyOnStartup: false,
  openWeeklyOnStartup: false,
  openDailyOnStartup: true,
  
  dailyFormat: "YYYYMMdd0001-DDD",
  dailyTemplate: "",
  dailyFolder: "",

  weeklyEnabled: true,
  weeklyFormat: "YYYYMMdd0000-[S]-WW",
  weeklyTemplate: "",
  weeklyFolder: "",

  monthlyEnabled: true,
  monthlyFormat: "YYYYMM000000-MMM",
  monthlyTemplate: "",
  monthlyFolder: "",

  yearlyEnabled: true,
  yearlyFormat: "YYYY00000000-YYYY",
  yearlyTemplate: "",
  yearlyFolder: "",


  runMigrationOnStartup: true,
  runMigrationOnManualOpen: true,
  startupDelaySeconds: 0,

  normalizerEnabled: false,
  runNormalizerOnStartup: false,
  normalizeDelaySeconds: 10,
  normalizerCase: "none",
  normalizerAccents: false,
  normalizerReplacements: [],
  addTimestamp: true,
  normalizerScopes: [],

  migrationEnabled: true,
  recurringTasksPath: "",
  taskSetCreatedDate: false,
  taskSetDoneDate: false,
  cancelExpiredScheduled: true,
  previousDayMigrationLookbackDays: 1,
  autoCompleteTaskFamilies: true,
  taskGlobalFilter: "#tasks",

  essentialStatuses: ESSENTIAL_STATUSES,
  customStatuses: ACCESSORY_STATUSES,

  calendarFirstDayOfWeek: 0,
  calendarShowWeekNumber: false,
  calendarShowRibbonButton: true,
  calendarOpenInNewLeaf: false,
  calendarConfirmCreate: true,

  frontmatterEnabled: true,
  frontmatterCreatedKey: "created",
  frontmatterUpdatedKey: "updated",
  frontmatterDateFormat: "yyyy-MM-dd'T'HH:mm",

  loggingEnabled: false,
  loggingFolder: "",
  loggingFilename: "cascade-log.md",
  loggingRetentionDays: 30,
  loggingStartup: true,
  loggingMigration: true,
  loggingNormalizer: true,
  loggingErrors: true,

  ignoredPaths: [],
  templatesFolder: "",
  folderTemplates: [],
};

export function mergeSettings(data: Partial<CascadeSettings> | null | undefined): CascadeSettings {
  const migratedIgnoredPaths = migrateIgnoredPaths(data);
  return {
    ...DEFAULT_SETTINGS,
    ...(data ?? {}),
    essentialStatuses: ESSENTIAL_STATUSES,
    customStatuses: mergeCustomStatuses(data?.customStatuses),
    normalizerScopes: data?.normalizerScopes ?? DEFAULT_SETTINGS.normalizerScopes,
    ignoredPaths: migratedIgnoredPaths,
    folderTemplates: data?.folderTemplates ?? [],
  };
}

function migrateIgnoredPaths(data: Partial<CascadeSettings> | null | undefined): string[] {
  if (data?.ignoredPaths && data.ignoredPaths.length > 0) return data.ignoredPaths;
  const legacy = new Set<string>();
  for (const p of data?.normalizerIgnored ?? []) legacy.add(p);
  for (const p of data?.frontmatterIgnoredPaths ?? []) legacy.add(p);
  return [...legacy];
}

function mergeCustomStatuses(saved: StatusDef[] | undefined): StatusDef[] {
  const bySymbol = new Map<string, StatusDef>();
  for (const status of ACCESSORY_STATUSES) bySymbol.set(status.symbol, status);
  for (const status of saved ?? []) bySymbol.set(status.symbol, status);
  return [...bySymbol.values()].map((status) => ({ ...status, showInMenu: status.showInMenu !== false }));
}
