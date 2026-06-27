import { describe, expect, it } from "vitest";
import { extractAllRootTasks, extractTasksWithSubtasks, isEphemeralTask, isOpenTask, isForwardableTask, taskKey, taskLooseKey } from "../../src/tasks/task-parser";
import {
  markEphemeralCancelledTaskBlockInContent,
  markOpenChildrenOfMigratedBlocks,
  normalizeLogSpacing,
  normalizeRootTaskSpacing,
  prepareForwardableMigratedBlock,
  prepareForwardableMigratedBlockPreservingStatus,
  prepareMigratedBlock,
  removeMigratedChildrenFromOpenBlocks,
  stripMarker,
} from "../../src/tasks/task-serializer";

describe("TaskParser", () => {
  it("extracts task blocks with subtasks", () => {
    const tasks = extractTasksWithSubtasks("- [ ] Parent\n  - [ ] Child\n- [x] Done");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].block).toContain("Child");
  });

  it("extractAllRootTasks includes completed and cancelled tasks", () => {
    const content = "- [ ] Open\n- [x] Done\n- [-] Cancelled\n- [/] Progress\n  - [ ] Child";
    const allTasks = extractAllRootTasks(content);
    expect(allTasks).toHaveLength(4);
    expect(allTasks.find((t) => t.status === " ")).toBeDefined();
    expect(allTasks.find((t) => t.status === "x")).toBeDefined();
    expect(allTasks.find((t) => t.status === "-")).toBeDefined();
    expect(allTasks.find((t) => t.status === "/")).toBeDefined();
  });

  it("builds stable keys ignoring metadata", () => {
    expect(taskKey("- [ ] Pay bill #tasks 📅 2026-06-15 🔁 every month")).toBe("PAY BILL 📅");
    expect(taskKey("- [ ] Campo 📅 2026-06-27 ⏰ 08:00 🔚 #tasks")).toBe("CAMPO 📅 ⏰ 08:00");
    expect(taskKey("- [ ] Campo 📅 2026-06-27 ⏰ 08:00 #tasks")).toBe("CAMPO 📅 ⏰ 08:00");
    expect(taskKey("- [ ] Campo 📅 2026-06-27 ⏰ 08:00 🔜 #tasks")).toBe("CAMPO 📅 ⏰ 08:00");
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

describe("forwardable/ephemeral markers", () => {
  it("detects 🔜 as forwardable", () => {
    const task = { line: "- [ ] Estudar 🔜", block: "- [ ] Estudar 🔜", status: " ", text: "Estudar 🔜", indent: "" };
    expect(isForwardableTask(task)).toBe(true);
    expect(isEphemeralTask(task)).toBe(false);
  });

  it("detects 🔚 as ephemeral", () => {
    const task = { line: "- [ ] Registrar 🔚", block: "- [ ] Registrar 🔚", status: " ", text: "Registrar 🔚", indent: "" };
    expect(isEphemeralTask(task)).toBe(true);
    expect(isForwardableTask(task)).toBe(false);
  });

  it("task without marker is neither forwardable nor ephemeral", () => {
    const task = { line: "- [ ] Tarefa simples", block: "- [ ] Tarefa simples", status: " ", text: "Tarefa simples", indent: "" };
    expect(isForwardableTask(task)).toBe(false);
    expect(isEphemeralTask(task)).toBe(false);
  });

  it("stripMarker removes 🔜 and 🔚 from line", () => {
    expect(stripMarker("- [ ] Estudar 🔜")).toBe("- [ ] Estudar");
    expect(stripMarker("- [ ] Registrar 🔚")).toBe("- [ ] Registrar");
    expect(stripMarker("- [ ] Sem marker")).toBe("- [ ] Sem marker");
  });

  it("prepareForwardableMigratedBlock preserves persistent/ephemeral markers", () => {
    const block = "- [ ] Estudar inglês 📅 2026-06-23 🔜";
    const result = prepareForwardableMigratedBlock(block);
    expect(result).toBe("- [ ] Estudar inglês 📅 2026-06-23 🔜");
    expect(result).toContain("🔜");
  });

  it("prepareForwardableMigratedBlockPreservingStatus preserves [/] and markers", () => {
    const block = "- [/] Estudar inglês 📅 2026-06-23 🔜";
    const result = prepareForwardableMigratedBlockPreservingStatus(block, "/");
    expect(result).toBe("- [/] Estudar inglês 📅 2026-06-23 🔜");
    expect(result).toContain("🔜");
  });

  it("markEphemeralCancelledTaskBlockInContent cancels task and children", () => {
    const content = ["- [ ] Registrar ponto 🔚", "\t- [ ] Subtarefa"].join("\n");
    const task = { line: "- [ ] Registrar ponto 🔚", block: content, status: " ", text: "Registrar ponto 🔚", indent: "" };
    const result = markEphemeralCancelledTaskBlockInContent(content, task);
    expect(result).toContain("- [-] Registrar ponto 🔚");
    expect(result).toContain("\t- [-] Subtarefa");
  });
});

describe("isOpenTask accepts [/]", () => {
  it("[ ] is an open task", () => {
    const task = { line: "- [ ] Tarefa", block: "- [ ] Tarefa", status: " ", text: "Tarefa", indent: "" };
    expect(isOpenTask(task)).toBe(true);
  });

  it("[/] is an open task", () => {
    const task = { line: "- [/] Tarefa", block: "- [/] Tarefa", status: "/", text: "Tarefa", indent: "" };
    expect(isOpenTask(task)).toBe(true);
  });

  it("[x] is not an open task", () => {
    const task = { line: "- [x] Tarefa", block: "- [x] Tarefa", status: "x", text: "Tarefa", indent: "" };
    expect(isOpenTask(task)).toBe(false);
  });

  it("[-] is not an open task", () => {
    const task = { line: "- [-] Tarefa", block: "- [-] Tarefa", status: "-", text: "Tarefa", indent: "" };
    expect(isOpenTask(task)).toBe(false);
  });

  it("extractTasksWithSubtasks extracts [/] tasks", () => {
    const tasks = extractTasksWithSubtasks("- [ ] Aberta\n- [/] Em progresso\n- [x] Concluida");
    expect(tasks).toHaveLength(2);
    expect(tasks[0].status).toBe(" ");
    expect(tasks[1].status).toBe("/");
  });
});

describe("prepareMigratedBlock preserves [/] status", () => {
  it("converts [ ] to [ ] at destination", () => {
    const result = prepareMigratedBlock("- [ ] Tarefa aberta");
    expect(result).toBe("- [ ] Tarefa aberta");
  });

  it("preserves [/] at destination", () => {
    const result = prepareMigratedBlock("- [/] Tarefa em progresso");
    expect(result).toBe("- [/] Tarefa em progresso");
  });

  it("preserves [/] with children", () => {
    const block = ["- [/] Pai em progresso", "\t- [ ] Filha"].join("\n");
    const result = prepareMigratedBlock(block);
    expect(result).toContain("- [/] Pai em progresso");
    expect(result).toContain("\t- [ ] Filha");
  });
});
