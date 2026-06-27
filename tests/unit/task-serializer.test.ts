import { describe, expect, it } from "vitest";
import {
  extractTimeMarker,
  hasTimeMarker,
  preserveTimeMarker,
  prepareForwardableMigratedBlock,
  prepareForwardableMigratedBlockPreservingStatus,
  prepareMigratedBlock,
  prepareRecurringTask,
  stripMarker,
  toOpenTask,
  withTaskStatus,
} from "../../src/tasks/task-serializer";
import { type TaskBlock } from "../../src/tasks/task-parser";

function block(taskLine: string): TaskBlock {
  return { line: taskLine, block: taskLine, status: " ", text: "", indent: "" };
}

describe("⏰ time marker", () => {
  it("detects time marker presence", () => {
    expect(hasTimeMarker("- [ ] Tarefa ⏰ 08:00")).toBe(true);
    expect(hasTimeMarker("- [ ] Tarefa sem hora")).toBe(false);
  });

  it("extracts time marker from line", () => {
    expect(extractTimeMarker("- [ ] Tarefa ⏰ 19:30 #tasks")).toBe(" ⏰ 19:30");
    expect(extractTimeMarker("- [ ] Tarefa sem hora")).toBe("");
  });

  it("preserves time marker through status change", () => {
    expect(withTaskStatus("- [ ] Tarefa ⏰ 08:00", ">")).toBe("- [>] Tarefa ⏰ 08:00");
    expect(withTaskStatus("- [/] Tarefa ⏰ 10:00", " ")).toBe("- [ ] Tarefa ⏰ 10:00");
  });

  it("preserves time marker through toOpenTask", () => {
    expect(toOpenTask("- [/] Tarefa ⏰ 19:00 #tasks")).toBe("- [ ] Tarefa ⏰ 19:00 #tasks");
  });

  it("preserves time marker through stripMarker", () => {
    const input = "- [ ] Tarefa 🔜 ⏰ 09:00 #tasks";
    expect(stripMarker(input)).toBe("- [ ] Tarefa ⏰ 09:00 #tasks");
  });

  it("preserves time marker in prepareMigratedBlock", () => {
    const block = "- [ ] Tarefa anual ⏰ 08:00 #tasks";
    expect(prepareMigratedBlock(block)).toBe("- [ ] Tarefa anual ⏰ 08:00 #tasks");
  });

  it("preserves time marker and persistent/ephemeral markers in prepareForwardableMigratedBlock", () => {
    const input = "- [ ] Tarefa 🔜 ⏰ 14:30 #tasks";
    expect(prepareForwardableMigratedBlock(input)).toBe("- [ ] Tarefa 🔜 ⏰ 14:30 #tasks");
  });

  it("preserves time marker in prepareForwardableMigratedBlockPreservingStatus", () => {
    const input = "- [/] Tarefa em progresso ⏰ 10:00 #tasks";
    const result = prepareForwardableMigratedBlockPreservingStatus(input, "/");
    expect(result).toContain("⏰ 10:00");
  });

  it("preserves time marker in prepareRecurringTask", () => {
    const task = block("- [ ] Reunião 🔁 every week on Monday 📅 2026-06-15 ⏰ 19:00 #tasks");
    const result = prepareRecurringTask(task, new Date(2026, 5, 15));
    expect(result).toContain("⏰ 19:00");
  });

  it("reattaches time marker when hashtag strips it", () => {
    const original = "- [ ] Tarefa ⏰ 08:00 #tasks";
    const processed = "- [ ] Tarefa sem hora #tasks";
    expect(preserveTimeMarker(original, processed)).toBe("- [ ] Tarefa sem hora ⏰ 08:00 #tasks");
  });

  it("does not duplicate time marker if already present", () => {
    const original = "- [ ] Tarefa ⏰ 08:00 #tasks";
    const processed = "- [ ] Tarefa ⏰ 08:00 #tasks";
    expect(preserveTimeMarker(original, processed)).toBe("- [ ] Tarefa ⏰ 08:00 #tasks");
  });
});
