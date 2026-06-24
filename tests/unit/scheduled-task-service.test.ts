import { TFile } from "obsidian";
import { describe, expect, it, vi } from "vitest";
import { ScheduledTaskService, scheduledRootTasks, upperLogPath } from "../../src/tasks/scheduled-task-service";

describe("ScheduledTaskService", () => {
  it("extracts root scheduled tasks as open clipboard text", () => {
    const content = ["- [<] Agendar projeto 📅 2026-06-20", "\t- [ ] Subtarefa", "- [ ] Outra"].join("\n");
    expect(scheduledRootTasks(content)).toEqual([
      {
        key: "AGENDAR PROJETO 📅 2026-06-20",
        clipboardText: "- [ ] Agendar projeto 📅 2026-06-20\n\t- [ ] Subtarefa",
      },
    ]);
  });

  it("finds upper log path from frontmatter wikilink", () => {
    expect(upperLogPath('---\nlog: "[[01-AGENDA/2026/06/202606000000-JUNHO|JUNHO]]"\n---')).toBe("01-AGENDA/2026/06/202606000000-JUNHO.md");
  });

  it("copies a scheduled task only when invoked manually", async () => {
    const activeFile = new TFile() as TFile & { content: string };
    activeFile.path = "daily.md";
    activeFile.content = "- [<] Agendar projeto 📅 2026-06-20";
    const app = {
      vault: {
        getAbstractFileByPath: vi.fn((path: string) => (path === activeFile.path ? activeFile : null)),
        read: vi.fn(async () => activeFile.content),
      },
      workspace: {
        getActiveFile: vi.fn(() => activeFile),
        getLeaf: vi.fn(() => ({ openFile: vi.fn() })),
      },
    };
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const service = new ScheduledTaskService(app as any);
    await service.copyFromActiveFile();
    await service.copyFromActiveFile();

    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenNthCalledWith(1, "- [ ] Agendar projeto 📅 2026-06-20");
    expect(app.vault.read).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it("positions cursor at end of upper log after opening", async () => {
    const activeFile = new TFile() as TFile & { content: string };
    activeFile.path = "daily.md";
    activeFile.content = "---\nlog: \"[[01-AGENDA/2026/06/202606000000-JUNHO|JUNHO]]\"\n---\n- [<] Agendar projeto 📅 2026-06-20";
    const upperFile = new TFile() as TFile & { content: string };
    upperFile.path = "01-AGENDA/2026/06/202606000000-JUNHO.md";
    upperFile.content = "# JUNHO\n";
    const setCursor = vi.fn();
    const getLine = vi.fn(() => "# JUNHO");
    const openFile = vi.fn();
    const leaf = { openFile, view: { editor: { setCursor, lineCount: vi.fn(() => 4), getLine } } };
    const app = {
      vault: {
        getAbstractFileByPath: vi.fn((path: string) => {
          if (path === activeFile.path) return activeFile;
          if (path === upperFile.path) return upperFile;
          return null;
        }),
        read: vi.fn(async () => activeFile.content),
      },
      workspace: {
        getActiveFile: vi.fn(() => activeFile),
        getLeaf: vi.fn(() => leaf),
      },
    };
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    const service = new ScheduledTaskService(app as any);
    await service.copyFromActiveFile();

    expect(openFile).toHaveBeenCalled();
    expect(setCursor).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
