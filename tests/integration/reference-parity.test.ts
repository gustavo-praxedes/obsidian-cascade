import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/config/defaults";
import { PathService } from "../../src/notes/path-service";
import { RecurrenceService } from "../../src/tasks/recurrence-service";

const referenceRoot = process.env.CASCADE_REFERENCE_SCRIPTS ?? "D:/OBSIDIAN/02-ARQUIVO/OBSIDIAN/SCRIPTS";
const requireFromTest = createRequire(import.meta.url);
const LEGACY_REFERENCE_SETTINGS = { ...DEFAULT_SETTINGS, weeklyEnabled: false, dailyFormat: "YYYYMMdd0000-DDD" };

describe("reference script parity", () => {
  const vaultConfigPath = `${referenceRoot}/vaultConfig.js`;
  const vaultRecurringPath = `${referenceRoot}/vaultRecurring.js`;

  it.runIf(existsSync(vaultConfigPath))("matches vaultConfig paths and base names across sample dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const cfg = requireFromTest(vaultConfigPath)();
      const paths = new PathService(LEGACY_REFERENCE_SETTINGS);
      const samples = Array.from({ length: 30 }, (_, index) => new Date(2026, index % 12, (index % 27) + 1));

      for (const date of samples) {
        expect(paths.annualPath(date)).toBe(cfg.annualPath(date));
        expect(paths.monthlyPath(date)).toBe(cfg.monthlyPath(date));
        expect(paths.dailyPath(date)).toBe(cfg.dailyPath(date));
        expect(paths.annualBase(date)).toBe(cfg.annualBase(date));
        expect(paths.monthlyBase(date)).toBe(cfg.monthlyBase(date));
        expect(paths.dailyBase(date)).toBe(cfg.dailyBase(date));
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it.runIf(existsSync(vaultConfigPath))("matches vaultConfig rendered log structure", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 11, 20));
    try {
      const cfg = requireFromTest(vaultConfigPath)();
      const paths = new PathService(LEGACY_REFERENCE_SETTINGS);
      const date = new Date(2026, 5, 15);

      expect(paths.renderAnnualLog(date)).toBe(cfg.renderAnnualLog(date));
      expect(paths.renderMonthlyLog(date)).toBe(cfg.renderMonthlyLog(date));
      expect(paths.renderDailyLog(date)).toBe(cfg.renderDailyLog(date));
    } finally {
      vi.useRealTimers();
    }
  });

  it.runIf(existsSync(vaultConfigPath) && existsSync(vaultRecurringPath))("matches vaultRecurring for recurring samples", () => {
    const cfg = requireFromTest(vaultConfigPath)();
    const reference = requireFromTest(vaultRecurringPath)(cfg);
    const recurrence = new RecurrenceService();
    const tasks = [
      "- [ ] Preparar reunião 🔁 every week on Monday ⏳ 2026-06-01 ⏰ 19:00 #tasks",
      "- [ ] Enviar relatório 🔁 every month on the 1st 📅 2026-07-01 ⏰ 08:00 #tasks",
      "- [ ] Auditoria 🔁 every year on June 1st 📅 2026-06-01 ⏰ 08:00 #tasks",
      "- [ ] Caminhada 🔁 every 2 weeks on Saturday 🛫 2026-06-06 #tasks",
    ];
    const dates = [new Date(2026, 5, 1), new Date(2026, 5, 6), new Date(2026, 5, 15), new Date(2026, 6, 1)];

    for (const task of tasks) {
      for (const date of dates) {
        expect(recurrence.appliesOnDate(task, date)).toBe(reference.appliesOnDate(task, date));
      }
    }
  });
});
