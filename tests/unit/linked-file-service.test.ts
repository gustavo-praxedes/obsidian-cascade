import { describe, expect, it } from "vitest";
import {
  computeLinkedStatus,
  extractLinkedFileKey,
  findWikilinkTargets,
  reconcileAllLinkedFiles,
  reconcileLinkedFiles,
} from "../../src/tasks/linked-file-service";

describe("LinkedFileService", () => {
  describe("extractLinkedFileKey", () => {
    it("extracts key from [[FILE]]", () => {
      expect(extractLinkedFileKey("- [ ] [[PROJETO]]")).toBe("PROJETO");
    });

    it("extracts key from [[FILE|Alias]]", () => {
      expect(extractLinkedFileKey("- [ ] [[PROJETO-MURILO|Murilo]]")).toBe("PROJETO-MURILO");
    });

    it("extracts key from text with surrounding content", () => {
      expect(extractLinkedFileKey("- [ ] text [[FILE|Alias]] more")).toBe("FILE");
    });

    it("returns null when no wikilink", () => {
      expect(extractLinkedFileKey("No link here")).toBeNull();
    });

    it("returns null for empty string", () => {
      expect(extractLinkedFileKey("")).toBeNull();
    });
  });

  describe("computeLinkedStatus", () => {
    it("returns x when all tasks are done", () => {
      expect(computeLinkedStatus("- [x] Tarefa 1\n- [x] Tarefa 2")).toBe("x");
    });

    it("returns space when all tasks are open", () => {
      expect(computeLinkedStatus("- [ ] Tarefa 1\n- [ ] Tarefa 2")).toBe(" ");
    });

    it("returns / when mix of done and open", () => {
      expect(computeLinkedStatus("- [x] Done\n- [ ] Open")).toBe("/");
    });

    it("returns / when any task is in progress", () => {
      expect(computeLinkedStatus("- [/] Progress\n- [ ] Open")).toBe("/");
    });

    it("returns null for empty content", () => {
      expect(computeLinkedStatus("")).toBeNull();
    });

    it("returns null for content with no tasks", () => {
      expect(computeLinkedStatus("# Just a heading\nNo tasks here")).toBeNull();
    });

    it("ignores cancelled tasks for status computation", () => {
      expect(computeLinkedStatus("- [x] Done\n- [-] Cancelled")).toBe("/");
    });

    it("single done task returns x", () => {
      expect(computeLinkedStatus("- [x] Only task")).toBe("x");
    });

    it("single open task returns space", () => {
      expect(computeLinkedStatus("- [ ] Only task")).toBe(" ");
    });
  });

  describe("reconcileLinkedFiles", () => {
    it("sets parent to done when all linked tasks are done", () => {
      const parent = "- [ ] [[PROJETO-MURILO|Murilo]]";
      const linked = "- [x] Tarefa 1\n- [x] Tarefa 2";
      expect(reconcileLinkedFiles(parent, "PROJETO-MURILO", linked)).toBe(
        "- [x] [[PROJETO-MURILO|Murilo]]",
      );
    });

    it("sets parent to in-progress when some linked tasks are done", () => {
      const parent = "- [ ] [[PROJETO-MURILO|Murilo]]";
      const linked = "- [x] Tarefa 1\n- [ ] Tarefa 2";
      expect(reconcileLinkedFiles(parent, "PROJETO-MURILO", linked)).toBe(
        "- [/] [[PROJETO-MURILO|Murilo]]",
      );
    });

    it("keeps parent open when all linked tasks are open", () => {
      const parent = "- [ ] [[PROJETO-MURILO|Murilo]]";
      const linked = "- [ ] Tarefa 1\n- [ ] Tarefa 2";
      expect(reconcileLinkedFiles(parent, "PROJETO-MURILO", linked)).toBe(
        "- [ ] [[PROJETO-MURILO|Murilo]]",
      );
    });

    it("returns original when linked file is empty", () => {
      const parent = "- [ ] [[PROJETO-MURILO|Murilo]]";
      expect(reconcileLinkedFiles(parent, "PROJETO-MURILO", "")).toBe(parent);
    });

    it("preserves indentation", () => {
      const parent = "\t- [ ] [[PROJETO|Proj]]";
      const linked = "- [x] Done";
      expect(reconcileLinkedFiles(parent, "PROJETO", linked)).toBe(
        "\t- [x] [[PROJETO|Proj]]",
      );
    });
  });

  describe("reconcileAllLinkedFiles", () => {
    it("returns unchanged content when no linked tasks found", () => {
      const content = "- [x] Normal task\n- [ ] Another task";
      const files = new Map<string, string>();
      expect(reconcileAllLinkedFiles(content, files)).toBe(content);
    });

    it("updates parent status based on linked file content", () => {
      const content = "- [ ] [[PROJETO|Proj]]\n- [x] Other";
      const files = new Map([["PROJETO", "- [x] Done\n- [x] Also done"]]);
      expect(reconcileAllLinkedFiles(content, files)).toContain("- [x] [[PROJETO|Proj]]");
    });

    it("handles missing linked file gracefully", () => {
      const content = "- [ ] [[MISSING|Missing]]";
      const files = new Map<string, string>();
      expect(reconcileAllLinkedFiles(content, files)).toBe(content);
    });

    it("handles linked file with no tasks", () => {
      const content = "- [ ] [[PROJETO|Proj]]";
      const files = new Map([["PROJETO", "# Just a heading\nNo tasks here"]]);
      expect(reconcileAllLinkedFiles(content, files)).toBe(content);
    });

    it("handles in-progress tasks in linked file", () => {
      const content = "- [ ] [[PROJETO|Proj]]";
      const files = new Map([["PROJETO", "- [/] In progress\n- [ ] Open"]]);
      expect(reconcileAllLinkedFiles(content, files)).toBe("- [/] [[PROJETO|Proj]]");
    });

    it("handles cancelled tasks in linked file", () => {
      const content = "- [ ] [[PROJETO|Proj]]";
      const files = new Map([["PROJETO", "- [x] Done\n- [-] Cancelled"]]);
      expect(reconcileAllLinkedFiles(content, files)).toBe("- [/] [[PROJETO|Proj]]");
    });

    it("processes multiple linked tasks", () => {
      const content = "- [ ] [[PROJETO-A|A]]\n- [ ] [[PROJETO-B|B]]";
      const files = new Map([
        ["PROJETO-A", "- [x] Done"],
        ["PROJETO-B", "- [ ] Open"],
      ]);
      const result = reconcileAllLinkedFiles(content, files);
      expect(result).toContain("- [x] [[PROJETO-A|A]]");
      expect(result).toContain("- [ ] [[PROJETO-B|B]]");
    });

    it("handles indented wikilink tasks", () => {
      const content = "\t- [ ] [[PROJETO|Proj]]";
      const files = new Map([["PROJETO", "- [x] Done"]]);
      expect(reconcileAllLinkedFiles(content, files)).toBe("\t- [x] [[PROJETO|Proj]]");
    });

    it("handles mixed indented and root wikilink tasks", () => {
      const content = "- [ ] [[PROJETO-A|A]]\n\t- [ ] [[PROJETO-B|B]]";
      const files = new Map([
        ["PROJETO-A", "- [x] Done"],
        ["PROJETO-B", "- [ ] Open"],
      ]);
      const result = reconcileAllLinkedFiles(content, files);
      expect(result).toContain("- [x] [[PROJETO-A|A]]");
      expect(result).toContain("\t- [ ] [[PROJETO-B|B]]");
    });
  });

  describe("findWikilinkTargets", () => {
    it("extracts basename from [[FILE]]", () => {
      const content = "- [ ] [[PROJETO-MURILO|Murilo]]";
      expect(findWikilinkTargets(content)).toEqual(new Set(["PROJETO-MURILO"]));
    });

    it("extracts multiple basenames", () => {
      const content = "- [ ] [[PROJETO-A|A]]\n- [ ] [[PROJETO-B|B]]";
      expect(findWikilinkTargets(content)).toEqual(new Set(["PROJETO-A", "PROJETO-B"]));
    });

    it("ignores non-wikilink lines", () => {
      const content = "- [ ] Regular task\n- [x] Done";
      expect(findWikilinkTargets(content).size).toBe(0);
    });

    it("deduplicates repeated keys", () => {
      const content = "- [ ] [[PROJETO|A]]\n- [ ] [[PROJETO|B]]";
      expect(findWikilinkTargets(content)).toEqual(new Set(["PROJETO"]));
    });

    it("handles indented tasks", () => {
      const content = "\t- [ ] [[PROJETO|Proj]]";
      expect(findWikilinkTargets(content)).toEqual(new Set(["PROJETO"]));
    });
  });
});
