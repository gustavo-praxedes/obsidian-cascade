import { describe, expect, it } from "vitest";
import { extractTasksWithSubtasks, taskKey, taskLooseKey } from "../../src/tasks/task-parser";

describe("TaskParser", () => {
  it("extracts task blocks with subtasks", () => {
    const tasks = extractTasksWithSubtasks("- [ ] Parent\n  - [ ] Child\n- [x] Done");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].block).toContain("Child");
  });

  it("builds stable keys ignoring metadata", () => {
    expect(taskKey("- [ ] Pay bill #tasks 📅 2026-06-15 🔁 every month")).toBe("PAY BILL 📅");
    expect(taskLooseKey("- [ ] Pay bill 123 📅 2026-06-16")).toBe("PAY BILL 123");
  });
});
