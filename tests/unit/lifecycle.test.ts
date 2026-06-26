import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/config/defaults";
import type { CascadeSettings } from "../../src/config/schema";
import { StartupOrchestrator } from "../../src/app/lifecycle";

if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = globalThis;
}

function mockSettings(overrides: Partial<CascadeSettings> = {}): CascadeSettings {
  return {
    ...DEFAULT_SETTINGS,
    startCascadeOnStartup: true,
    runMigrationOnStartup: false,
    runNormalizerOnStartup: false,
    startupDelayMode: 0,
    startupDelayCustomSeconds: 0,
    openAnnualOnStartup: false,
    openMonthlyOnStartup: false,
    openWeeklyOnStartup: false,
    openDailyOnStartup: false,
    ...overrides,
  };
}

function createOrchestrator(settings: CascadeSettings) {
  const vault = {
    getAbstractFileByPath: () => null,
    getMarkdownFiles: () => [],
    on: vi.fn(),
  };
  const workspace = {
    getLeaf: () => ({ openFile: vi.fn() }),
  };
  const paths = {
    dailyPath: () => "",
    dailyPrefix: () => "",
  } as any;
  const notes = {
    createAnnual: vi.fn(),
    createMonthly: vi.fn(),
    createWeekly: vi.fn(),
    createDaily: vi.fn(),
  } as any;
  const migration = { run: vi.fn() } as any;
  const normalizer = { normalizeAll: vi.fn() } as any;
  const log = {
    startup: { info: vi.fn(), debug: vi.fn() },
  } as any;

  return new StartupOrchestrator(vault as any, workspace as any, settings, paths, notes, migration, normalizer, log);
}

describe("StartupOrchestrator startup delay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips delay when startupDelayMode is 0", async () => {
    const settings = mockSettings({ startupDelayMode: 0 });
    const orch = createOrchestrator(settings);
    const spy = vi.spyOn(window, "setTimeout");

    const promise = orch.run();
    await vi.advanceTimersByTimeAsync(0);
    await promise;

    expect(spy).not.toHaveBeenCalledWith(expect.any(Function), 5000);
    spy.mockRestore();
  });

  it("applies delay when startupDelayMode > 0", async () => {
    const settings = mockSettings({ startupDelayMode: 5 });
    const orch = createOrchestrator(settings);
    const spy = vi.spyOn(window, "setTimeout");

    const promise = orch.run();
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 5000);
    spy.mockRestore();
  });

  it("skips delay when startupDelayMode is negative (handled by mode)", async () => {
    const settings = mockSettings({ startupDelayMode: 0 }); // negative not possible with new model
    const orch = createOrchestrator(settings);
    const spy = vi.spyOn(window, "setTimeout");

    const promise = orch.run();
    await vi.advanceTimersByTimeAsync(0);
    await promise;

    expect(spy).not.toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
    spy.mockRestore();
  });

  it("uses custom delay when mode is custom", async () => {
    const settings = mockSettings({ startupDelayMode: "custom", startupDelayCustomSeconds: 7 });
    const orch = createOrchestrator(settings);
    const spy = vi.spyOn(window, "setTimeout");

    const promise = orch.run();
    await vi.advanceTimersByTimeAsync(7000);
    await promise;

    expect(spy).toHaveBeenCalledWith(expect.any(Function), 7000);
    spy.mockRestore();
  });
});
