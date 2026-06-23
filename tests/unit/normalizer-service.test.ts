import { describe, expect, it } from "vitest";
import { TFile } from "obsidian";
import { DEFAULT_SETTINGS } from "../../src/config/defaults";
import { NormalizerService } from "../../src/notes/normalizer-service";

describe("NormalizerService", () => {
  it("normalizes filenames with title case", async () => {
    const file = new TFile();
    Object.assign(file, { path: "Notas/minha nota especial.md" });
    let renamedTo = "";
    const app = {
      vault: {
        getAbstractFileByPath: () => null,
        rename: async (_file: TFile, target: string) => {
          renamedTo = target;
        },
      },
      workspace: {
        getLeaf: () => ({ openFile: async () => undefined }),
      },
    };
    const normalizer = new NormalizerService(app as any, {
      ...DEFAULT_SETTINGS,
      normalizerEnabled: true,
      addTimestamp: false,
      normalizerCase: "title",
    });

    await normalizer.normalizeFile(file);

    expect(renamedTo).toBe("Notas/Minha-Nota-Especial.md");
  });
});
