import { describe, expect, it, vi } from "vitest";
import { CalendarService } from "../../src/calendar/calendar-service";
import type { CascadeSettings } from "../../src/config/schema";
import type { PathService } from "../../src/notes/path-service";
import type { FileService } from "../../src/vault/file-service";

function makeSettings(overrides: Partial<CascadeSettings> = {}): CascadeSettings {
  return {
    calendarFirstDayOfWeek: 0,
    calendarShowWeekNumber: false,
    calendarShowRibbonButton: true,
    calendarOpenInNewLeaf: false,
    calendarConfirmCreate: true,
    ...overrides,
  } as CascadeSettings;
}

function makePaths(): PathService {
  return {
    dailyPath: (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `01-AGENDA/${y}/${m}/${y}${m}${d}0000-${d}.md`;
    },
    dailyPrefix: (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}${m}${d}`;
    },
  } as PathService;
}

function makeFiles(existsFn: (path: string) => boolean = () => false): FileService {
  return { exists: existsFn } as unknown as FileService;
}

describe("CalendarService", () => {
  describe("monthGrid", () => {
    it("returns exactly 42 dates", () => {
      const svc = new CalendarService(makeSettings(), makePaths(), makeFiles(), {} as never);
      const grid = svc.monthGrid(new Date(2026, 5, 1));
      expect(grid).toHaveLength(42);
    });

    it("starts before the first day when firstDayOfWeek offsets it", () => {
      const svc = new CalendarService(makeSettings({ calendarFirstDayOfWeek: 1 }), makePaths(), makeFiles(), {} as never);
      const grid = svc.monthGrid(new Date(2026, 0, 1));
      expect(grid[0].getMonth()).toBe(11);
      expect(grid[0].getFullYear()).toBe(2025);
    });

    it("January 2026 with Sunday start — first cell is Dec 28", () => {
      const svc = new CalendarService(makeSettings({ calendarFirstDayOfWeek: 0 }), makePaths(), makeFiles(), {} as never);
      const grid = svc.monthGrid(new Date(2026, 0, 1));
      expect(grid[0].toISOString().slice(0, 10)).toBe("2025-12-28");
    });

    it("February 2028 (leap year) includes Feb 29", () => {
      const svc = new CalendarService(makeSettings(), makePaths(), makeFiles(), {} as never);
      const grid = svc.monthGrid(new Date(2028, 1, 1));
      const has29 = grid.some((d) => d.getMonth() === 1 && d.getDate() === 29);
      expect(has29).toBe(true);
    });
  });

  describe("getWeekNumber", () => {
    it("Jan 1 2026 is week 1", () => {
      const svc = new CalendarService(makeSettings(), makePaths(), makeFiles(), {} as never);
      expect(svc.getWeekNumber(new Date(2026, 0, 1))).toBe(1);
    });

    it("Dec 31 2026 is week 53", () => {
      const svc = new CalendarService(makeSettings(), makePaths(), makeFiles(), {} as never);
      expect(svc.getWeekNumber(new Date(2026, 11, 31))).toBe(53);
    });

    it("Jan 4 2027 is week 1 of 2027", () => {
      const svc = new CalendarService(makeSettings(), makePaths(), makeFiles(), {} as never);
      expect(svc.getWeekNumber(new Date(2027, 0, 4))).toBe(1);
    });
  });

  describe("hasDaily", () => {
    it("returns true when file exists by exact path", () => {
      const svc = new CalendarService(makeSettings(), makePaths(), makeFiles(() => true), {} as never);
      expect(svc.hasDaily(new Date(2026, 5, 15))).toBe(true);
    });

    it("returns false when no file matches", () => {
      const svc = new CalendarService(makeSettings(), makePaths(), makeFiles(() => false), {
        getMarkdownFiles: () => [],
      } as never);
      expect(svc.hasDaily(new Date(2026, 5, 15))).toBe(false);
    });

    it("caches results for the same month", () => {
      const existsFn = vi.fn(() => false);
      const vault = { getMarkdownFiles: vi.fn(() => []) };
      const svc = new CalendarService(makeSettings(), makePaths(), makeFiles(existsFn), vault as never);
      svc.hasDaily(new Date(2026, 5, 10));
      svc.hasDaily(new Date(2026, 5, 20));
      expect(existsFn).toHaveBeenCalledTimes(2);
      expect(vault.getMarkdownFiles).toHaveBeenCalledTimes(2);
    });

    it("clears cache when month changes", () => {
      const existsFn = vi.fn(() => false);
      const vault = { getMarkdownFiles: vi.fn(() => []) };
      const svc = new CalendarService(makeSettings(), makePaths(), makeFiles(existsFn), vault as never);
      svc.hasDaily(new Date(2026, 5, 10));
      svc.hasDaily(new Date(2026, 6, 10));
      expect(existsFn).toHaveBeenCalledTimes(2);
    });
  });
});
