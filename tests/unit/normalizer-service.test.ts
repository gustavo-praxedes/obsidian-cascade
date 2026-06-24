import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import { DEFAULT_SETTINGS } from "../../src/config/defaults";
import { NormalizerService, slugify, stripAccents, applyCase } from "../../src/notes/normalizer-service";
import type { CascadeSettings } from "../../src/config/schema";

function makeSettings(overrides: Partial<CascadeSettings> = {}): CascadeSettings {
  return { ...DEFAULT_SETTINGS, ...overrides } as CascadeSettings;
}

function makeApp(files: Map<string, TFile> = new Map()) {
  let renamedTo = "";
  return {
    vault: {
      getAbstractFileByPath: (path: string) => files.get(path) ?? null,
      getMarkdownFiles: () => [...files.values()],
      rename: async (_file: TFile, target: string) => { renamedTo = target; },
    },
    workspace: {
      getLeaf: () => ({ openFile: async () => undefined }),
    },
    _getRenamedTo: () => renamedTo,
  };
}

function makeFile(path: string): TFile {
  const file = new TFile();
  Object.assign(file, { path });
  return file;
}

describe("NormalizerService", () => {
  it("normalizes filenames with title case", async () => {
    const file = makeFile("Notas/minha nota especial.md");
    const app = makeApp();
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: false,
      normalizerCase: "title",
    }));
    await normalizer.normalizeFile(file);
    expect(app._getRenamedTo()).toBe("Notas/Minha-Nota-Especial.md");
  });

  it("preserves existing 12-digit timestamp", async () => {
    const file = makeFile("Notas/202606151200-minha nota.md");
    const app = makeApp();
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: true,
      normalizerCase: "title",
    }));
    await normalizer.normalizeFile(file);
    expect(app._getRenamedTo()).toBe("Notas/202606151200-Minha-Nota.md");
  });

  it("generates new timestamp when none exists", async () => {
    const file = makeFile("Notas/minha nota.md");
    const app = makeApp();
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: true,
      normalizerCase: "title",
    }));
    await normalizer.normalizeFile(file);
    const renamed = app._getRenamedTo();
    expect(renamed).toMatch(/^Notas\/\d{12}-Minha-Nota\.md$/);
  });

  it("strips timestamp when addTimestamp is false", async () => {
    const file = makeFile("Notas/202606151200-minha nota.md");
    const app = makeApp();
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: false,
      normalizerCase: "title",
    }));
    await normalizer.normalizeFile(file);
    expect(app._getRenamedTo()).toBe("Notas/Minha-Nota.md");
  });

  it("applies custom replacements", async () => {
    const file = makeFile("Notas/a b c.md");
    const app = makeApp();
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: false,
      normalizerCase: "lowercase",
      normalizerReplacements: [{ from: " ", to: "-" }],
    }));
    await normalizer.normalizeFile(file);
    expect(app._getRenamedTo()).toBe("Notas/a-b-c.md");
  });

  it("strips accents when normalizerAccents is false", async () => {
    const file = makeFile("Notas/ação.crítica.md");
    const app = makeApp();
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: false,
      normalizerAccents: false,
      normalizerCase: "lowercase",
    }));
    await normalizer.normalizeFile(file);
    expect(app._getRenamedTo()).toBe("Notas/acao-critica.md");
  });

  it("keeps accents when normalizerAccents is true", async () => {
    const file = makeFile("Notas/Minha Ação.md");
    const app = makeApp();
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: false,
      normalizerAccents: true,
      normalizerCase: "lowercase",
    }));
    await normalizer.normalizeFile(file);
    expect(app._getRenamedTo()).toBe("Notas/minha-ação.md");
  });

  it("collapses consecutive hyphens", async () => {
    const file = makeFile("Notas/a   b.md");
    const app = makeApp();
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: false,
      normalizerCase: "lowercase",
    }));
    await normalizer.normalizeFile(file);
    expect(app._getRenamedTo()).toBe("Notas/a-b.md");
  });

  it("skips files not in scope", async () => {
    const file = makeFile("Templates/modelo.md");
    const app = makeApp();
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: false,
      normalizerCase: "lowercase",
      normalizerScopes: ["Notas/"],
    }));
    await normalizer.normalizeFile(file);
    expect(app._getRenamedTo()).toBe("");
  });

  it("skips ignored files", async () => {
    const file = makeFile("01-AGENDA/2026/202606150000-15.md");
    const app = makeApp();
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: false,
      normalizerCase: "lowercase",
      normalizerIgnored: ["01-AGENDA/"],
    }));
    await normalizer.normalizeFile(file);
    expect(app._getRenamedTo()).toBe("");
  });

  it("resolves path collisions with -01 suffix", async () => {
    const file = makeFile("Notas/nota.md");
    const existing = makeFile("Notas/Nota.md");
    const files = new Map([["Notas/Nota.md", existing]]);
    const app = makeApp(files);
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: false,
      normalizerCase: "title",
    }));
    await normalizer.normalizeFile(file);
    expect(app._getRenamedTo()).toBe("Notas/Nota-01.md");
  });

  it("does nothing when normalizer is disabled", async () => {
    const file = makeFile("Notas/minha nota.md");
    const app = makeApp();
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: false,
    }));
    await normalizer.normalizeFile(file);
    expect(app._getRenamedTo()).toBe("");
  });

  it("does nothing when path is unchanged", async () => {
    const file = makeFile("Notas/Minha-Nota.md");
    const app = makeApp();
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: false,
      normalizerCase: "title",
    }));
    await normalizer.normalizeFile(file);
    expect(app._getRenamedTo()).toBe("");
  });

  it("normalizeAll processes all markdown files", async () => {
    const file1 = makeFile("Notas/nota um.md");
    const file2 = makeFile("Notas/nota dois.md");
    const files = new Map([["Notas/nota um.md", file1], ["Notas/nota dois.md", file2]]);
    let renameCount = 0;
    const app = {
      vault: {
        getAbstractFileByPath: (path: string) => files.get(path) ?? null,
        getMarkdownFiles: () => [...files.values()],
        rename: async () => { renameCount++; },
      },
      workspace: { getLeaf: () => ({ openFile: async () => undefined }) },
    };
    const normalizer = new NormalizerService(app as any, makeSettings({
      normalizerEnabled: true,
      addTimestamp: false,
      normalizerCase: "title",
      normalizeDelaySeconds: 0,
    }));
    await normalizer.normalizeAll();
    expect(renameCount).toBe(2);
  });
});

describe("slugify", () => {
  it("replaces spaces with hyphens", () => {
    expect(slugify("hello world")).toBe("hello-world");
  });

  it("collapses consecutive special chars", () => {
    expect(slugify("a   b")).toBe("a-b");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("-hello-")).toBe("hello");
  });

  it("handles unicode letters", () => {
    expect(slugify("ação crítica")).toBe("ação-crítica");
  });
});

describe("stripAccents", () => {
  it("removes diacritics", () => {
    expect(stripAccents("ação")).toBe("acao");
  });

  it("handles mixed accented and plain", () => {
    expect(stripAccents("café résumé")).toBe("cafe resume");
  });
});

describe("applyCase", () => {
  it("uppercase", () => {
    expect(applyCase("hello world", "uppercase")).toBe("HELLO WORLD");
  });

  it("lowercase", () => {
    expect(applyCase("Hello World", "lowercase")).toBe("hello world");
  });

  it("title", () => {
    expect(applyCase("hello-world", "title")).toBe("Hello-World");
  });

  it("slug", () => {
    expect(applyCase("Hello World! @#$", "slug")).toBe("hello-world");
  });

  it("sentence", () => {
    expect(applyCase("hello world", "sentence")).toBe("Hello world");
  });

  it("camelCase", () => {
    expect(applyCase("hello world", "camelCase")).toBe("helloWorld");
  });

  it("PascalCase", () => {
    expect(applyCase("hello world", "PascalCase")).toBe("HelloWorld");
  });

  it("snake_case", () => {
    expect(applyCase("Hello World", "snake_case")).toBe("hello_world");
  });
});
