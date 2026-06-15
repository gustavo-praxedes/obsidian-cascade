import { describe, expect, it } from "vitest";
import { scheduledRootTasks, upperLogPath } from "../../src/tasks/scheduled-task-service";

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
});
