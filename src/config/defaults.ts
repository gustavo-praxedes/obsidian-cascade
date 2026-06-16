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
  agendaRoot: "01-AGENDA",
  openTodayOnStartup: true,
  runMigrationOnStartup: true,
  runMigrationOnManualOpen: true,
  runNormalizerOnStartup: true,
  startupDelaySeconds: 0,
  startupWaitCondition: "fixed",
  startupWaitMaxSeconds: 30,
  startupVaultIdleSeconds: 3,
  dailyEnabled: true,
  weeklyEnabled: true,
  weeklyStructure: "folder-index",
  monthlyEnabled: true,
  yearlyEnabled: true,
  operationalYearStartMonth: 1,
  dailyFormat: "YYYYMMdd0001-DDD",
  weeklyFormat: "YYYYMMdd0000-[S]-WW",
  monthlyFormat: "YYYYMM000000-MMM",
  yearlyFormat: "YYYY00000000-YYYY",
  noteFormat: "YYYYMMddHHmm-SLUG",
  normalizerEnabled: true,
  normalizerUppercase: true,
  normalizerAccents: true,
  normalizerTimestamp: true,
  normalizerScopes: ["01-AGENDA"],
  normalizerIgnored: ["02-ARQUIVO/OBSIDIAN/TEMPLATES"],
  templatesFolder: "",
  dailyTemplate: "",
  weeklyTemplate: "",
  monthlyTemplate: "",
  yearlyTemplate: "",
  folderTemplates: [],
  recurringTasksPath: "02-ARQUIVO/TAREFAS/202606101111-01-RECORRENTES.md",
  taskGlobalFilter: "#tasks",
  taskSetCreatedDate: false,
  taskSetDoneDate: false,
  migrationEnabled: true,
  cancelExpiredScheduled: true,
  previousDayMigrationLookbackDays: 1,
  autoCompleteTaskFamilies: true,
  essentialStatuses: ESSENTIAL_STATUSES,
  customStatuses: ACCESSORY_STATUSES,
  calendarFirstDayOfWeek: 0,
  calendarShowWeekNumbers: false,
  calendarOpenInNewLeaf: false,
  calendarConfirmCreate: true,
  frontmatterEnabled: true,
  frontmatterCreatedKey: "created",
  frontmatterUpdatedKey: "updated",
  frontmatterDateFormat: "yyyy-MM-dd'T'HH:mm",
  frontmatterIgnoredPaths: [],
};

export function mergeSettings(data: Partial<CascadeSettings> | null | undefined): CascadeSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(data ?? {}),
    essentialStatuses: ESSENTIAL_STATUSES,
    customStatuses: mergeCustomStatuses(data?.customStatuses),
    normalizerScopes: data?.normalizerScopes ?? DEFAULT_SETTINGS.normalizerScopes,
    normalizerIgnored: data?.normalizerIgnored ?? DEFAULT_SETTINGS.normalizerIgnored,
    folderTemplates: data?.folderTemplates ?? [],
    frontmatterIgnoredPaths: data?.frontmatterIgnoredPaths ?? [],
  };
}

function mergeCustomStatuses(saved: StatusDef[] | undefined): StatusDef[] {
  const bySymbol = new Map<string, StatusDef>();
  for (const status of ACCESSORY_STATUSES) bySymbol.set(status.symbol, status);
  for (const status of saved ?? []) bySymbol.set(status.symbol, status);
  return [...bySymbol.values()].map((status) => ({ ...status, showInMenu: status.showInMenu !== false }));
}
