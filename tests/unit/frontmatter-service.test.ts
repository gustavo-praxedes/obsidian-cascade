import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { TFile } from "obsidian";
import { FrontmatterService, formatFrontmatterDate } from "../../src/notes/frontmatter-service";
import { DEFAULT_SETTINGS } from "../../src/config/defaults";
import type { CascadeSettings } from "../../src/config/schema";

function makeSettings(overrides: Partial<CascadeSettings> = {}): CascadeSettings {
  return { ...DEFAULT_SETTINGS, ...overrides } as CascadeSettings;
}

function makeFile(path: string, ctime = Date.now()): TFile {
  const file = new TFile();
  Object.assign(file, { path, stat: { ctime, mtime: Date.now() } });
  return file;
}

function makeApp(overrides: { files?: Map<string, TFile>; processFrontMatter?: unknown } = {}) {
  const files = overrides.files ?? new Map();
  const processFrontMatter =
    overrides.processFrontMatter ??
    vi.fn(async (_f: TFile, cb: (fm: Record<string, unknown>) => void) => {
      const fm: Record<string, unknown> = {};
      cb(fm);
      return fm;
    });
  return {
    vault: {
      getAbstractFileByPath: (path: string) => files.get(path) ?? null,
      getMarkdownFiles: () => [...files.values()],
    },
    fileManager: { processFrontMatter },
  };
}

describe("formatFrontmatterDate", () => {
  const date = new Date(2026, 5, 24, 15, 30, 45);

  it("formats default ISO-like format", () => {
    expect(formatFrontmatterDate(date, "yyyy-MM-dd'T'HH:mm")).toBe("2026-06-24T15:30");
  });

  it("includes seconds when ss token present", () => {
    expect(formatFrontmatterDate(date, "yyyy-MM-dd'T'HH:mm:ss")).toBe("2026-06-24T15:30:45");
  });

  it("formats dd-MM-yyyy style", () => {
    expect(formatFrontmatterDate(date, "dd/MM/yyyy HH:mm")).toBe("24/06/2026 15:30");
  });

  it("formats with XXX timezone suffix", () => {
    const result = formatFrontmatterDate(date, "yyyy-MM-dd'T'HH:mm:ssXXX");
    expect(result).toMatch(/^2026-06-24T15:30:45(Z|[+-]\d{2}:\d{2})$/);
  });

  it("formats with xx timezone offset", () => {
    const result = formatFrontmatterDate(date, "yyyy-MM-dd'T'HH:mmxx");
    expect(result).toMatch(/^2026-06-24T15:30[+-]\d{4}$/);
  });
});

describe("FrontmatterService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as any).window = {
      clearTimeout: globalThis.clearTimeout?.bind(globalThis) ?? ((id: any) => clearTimeout(id)),
      setTimeout: globalThis.setTimeout?.bind(globalThis) ?? ((fn: any, ms?: number) => setTimeout(fn, ms)),
    };
  });

  afterEach(() => {
    delete (globalThis as any).window;
    vi.useRealTimers();
  });

  it("initialize sets created and updated keys", async () => {
    const file = makeFile("notas/test.md");
    const app = makeApp({ files: new Map([["notas/test.md", file]]) });
    const fm: Record<string, unknown> = {};
    app.fileManager.processFrontMatter = vi.fn(
      async (_f: TFile, cb: (fm: Record<string, unknown>) => void) => {
        cb(fm);
        return fm;
      },
    );
    const service = new FrontmatterService(app as any, makeSettings({ frontmatterEnabled: true }));
    await service.initialize(file);
    expect(fm.created).toBeDefined();
    expect(fm.updated).toBeDefined();
  });

  it("initialize preserves existing created key", async () => {
    const file = makeFile("notas/test.md");
    const app = makeApp({ files: new Map([["notas/test.md", file]]) });
    const fm: Record<string, unknown> = { created: "2026-01-01T00:00" };
    app.fileManager.processFrontMatter = vi.fn(
      async (_f: TFile, cb: (fm: Record<string, unknown>) => void) => {
        cb(fm);
        return fm;
      },
    );
    const service = new FrontmatterService(app as any, makeSettings({ frontmatterEnabled: true }));
    await service.initialize(file);
    expect(fm.created).toBe("2026-01-01T00:00");
  });

  it("initialize skips when disabled", async () => {
    const file = makeFile("notas/test.md");
    const app = makeApp({ files: new Map([["notas/test.md", file]]) });
    const service = new FrontmatterService(app as any, makeSettings({ frontmatterEnabled: false }));
    await service.initialize(file);
    expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  it("initialize skips ignored paths", async () => {
    const file = makeFile("Templates/modelo.md");
    const app = makeApp({ files: new Map([["Templates/modelo.md", file]]) });
    const service = new FrontmatterService(
      app as any,
      makeSettings({
        frontmatterEnabled: true,
        frontmatterIgnoredPaths: ["Templates/"],
      }),
    );
    await service.initialize(file);
    expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  it("schedule debounce triggers touch after 2s", async () => {
    const file = makeFile("notas/test.md");
    const app = makeApp({ files: new Map([["notas/test.md", file]]) });
    const fm: Record<string, unknown> = {};
    app.fileManager.processFrontMatter = vi.fn(
      async (_f: TFile, cb: (fm: Record<string, unknown>) => void) => {
        cb(fm);
        return fm;
      },
    );
    const service = new FrontmatterService(app as any, makeSettings({ frontmatterEnabled: true }));
    service.schedule(file);
    expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2000);
    await vi.waitFor(() => expect(app.fileManager.processFrontMatter).toHaveBeenCalled());
    expect(fm.updated).toBeDefined();
  });

  it("dispose clears all timers", async () => {
    const file = makeFile("notas/test.md");
    const app = makeApp({ files: new Map([["notas/test.md", file]]) });
    app.fileManager.processFrontMatter = vi.fn();
    const service = new FrontmatterService(app as any, makeSettings({ frontmatterEnabled: true }));
    service.schedule(file);
    service.dispose();
    vi.advanceTimersByTime(5000);
    expect(app.fileManager.processFrontMatter).not.toHaveBeenCalled();
  });

  it("initializeAll processes all files", async () => {
    const file1 = makeFile("notas/a.md");
    const file2 = makeFile("notas/b.md");
    const files = new Map([
      ["notas/a.md", file1],
      ["notas/b.md", file2],
    ]);
    const app = makeApp({ files });
    const fmStore = new Map<string, Record<string, unknown>>();
    app.fileManager.processFrontMatter = vi.fn(
      async (f: TFile, cb: (fm: Record<string, unknown>) => void) => {
        const fm = fmStore.get(f.path) ?? {};
        cb(fm);
        fmStore.set(f.path, fm);
        return fm;
      },
    );
    const service = new FrontmatterService(
      app as any,
      makeSettings({ frontmatterEnabled: true }),
    );
    const count = await service.initializeAll();
    expect(count).toBe(2);
  });

  it("uses custom key names from settings", async () => {
    const file = makeFile("notas/test.md");
    const app = makeApp({ files: new Map([["notas/test.md", file]]) });
    const fm: Record<string, unknown> = {};
    app.fileManager.processFrontMatter = vi.fn(
      async (_f: TFile, cb: (fm: Record<string, unknown>) => void) => {
        cb(fm);
        return fm;
      },
    );
    const service = new FrontmatterService(
      app as any,
      makeSettings({
        frontmatterEnabled: true,
        frontmatterCreatedKey: "data_criacao",
        frontmatterUpdatedKey: "data_atualizacao",
      }),
    );
    await service.initialize(file);
    expect(fm.data_criacao).toBeDefined();
    expect(fm.data_atualizacao).toBeDefined();
    expect(fm.created).toBeUndefined();
    expect(fm.updated).toBeUndefined();
  });
});
