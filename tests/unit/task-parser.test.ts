import { describe, expect, it } from "vitest";
import { extractTasksWithSubtasks, taskKey, taskLooseKey } from "../../src/tasks/task-parser";
import {
  markOpenChildrenOfMigratedBlocks,
  normalizeLogSpacing,
  normalizeRootTaskSpacing,
  removeMigratedChildrenFromOpenBlocks,
} from "../../src/tasks/task-serializer";

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

describe("migration block repair", () => {
  it("marks open children under migrated parents as migrated", () => {
    const input = ["- [>] Pai", "\t- [ ] Filha aberta", "\t- [x] Filha concluida"].join("\n");
    expect(markOpenChildrenOfMigratedBlocks(input)).toBe(["- [>] Pai", "\t- [>] Filha aberta", "\t- [x] Filha concluida"].join("\n"));
  });

  it("removes migrated children from carried open blocks", () => {
    const input = ["- [ ] Pai", "\t- [>] Filha migrada", "\t- [ ] Filha aberta"].join("\n");
    expect(removeMigratedChildrenFromOpenBlocks(input)).toBe(["- [ ] Pai", "\t- [ ] Filha aberta"].join("\n"));
  });
});

describe("normalizeRootTaskSpacing", () => {
  it("adds a blank line between root task blocks without splitting children", () => {
    const input = ["# Hoje", "", "- [ ] Pai 1", "\t- [ ] Filha", "- [ ] Pai 2", "\t- [ ] Filha 2"].join("\n");
    expect(normalizeRootTaskSpacing(input)).toBe(["# Hoje", "", "- [ ] Pai 1", "\t- [ ] Filha", "", "- [ ] Pai 2", "\t- [ ] Filha 2"].join("\n"));
  });

  it("adds a blank line between a task block and the next heading", () => {
    const input = ["# Junho", "", "## 15", "", "- [>] Tarefa migrada", "## 16"].join("\n");
    expect(normalizeLogSpacing(input)).toBe(["# Junho", "", "## 15", "", "- [>] Tarefa migrada", "", "## 16"].join("\n"));
  });
});
