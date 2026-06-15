import { describe, expect, it } from "vitest";
import { reconcileTaskFamilies } from "../../src/tasks/task-family-service";

describe("TaskFamilyService", () => {
  it("completes open and in-progress descendants when a parent is completed", () => {
    const input = ["- [x] Pai", "\t- [ ] Filha aberta", "\t- [/] Filha progresso", "\t- [i] Filha ignorada"].join("\n");
    expect(reconcileTaskFamilies(input)).toBe(["- [x] Pai", "\t- [x] Filha aberta", "\t- [x] Filha progresso", "\t- [i] Filha ignorada"].join("\n"));
  });

  it("completes the parent when all direct children are completed", () => {
    const input = ["- [/] Pai", "\t- [x] Filha 1", "\t- [x] Filha 2"].join("\n");
    expect(reconcileTaskFamilies(input)).toBe(["- [x] Pai", "\t- [x] Filha 1", "\t- [x] Filha 2"].join("\n"));
  });

  it("unchecks descendants when a completed parent is unchecked", () => {
    const previous = ["- [x] Pai", "\t- [x] Filha 1", "\t- [x] Filha 2", "\t- [i] Filha ignorada"].join("\n");
    const input = ["- [ ] Pai", "\t- [x] Filha 1", "\t- [x] Filha 2", "\t- [i] Filha ignorada"].join("\n");
    expect(reconcileTaskFamilies(input, previous)).toBe(["- [ ] Pai", "\t- [ ] Filha 1", "\t- [ ] Filha 2", "\t- [i] Filha ignorada"].join("\n"));
  });

  it("reopens a completed parent when a new open child is added", () => {
    const previous = ["- [x] Pai", "\t- [x] Filha antiga"].join("\n");
    const input = ["- [x] Pai", "\t- [x] Filha antiga", "\t- [ ] Filha nova"].join("\n");
    expect(reconcileTaskFamilies(input, previous)).toBe(["- [ ] Pai", "\t- [x] Filha antiga", "\t- [ ] Filha nova"].join("\n"));
  });

  it("reopens a completed parent when a completed child is unchecked", () => {
    const previous = ["- [x] Pai", "\t- [x] Filha 1", "\t- [x] Filha 2"].join("\n");
    const input = ["- [x] Pai", "\t- [ ] Filha 1", "\t- [x] Filha 2"].join("\n");
    expect(reconcileTaskFamilies(input, previous)).toBe(["- [ ] Pai", "\t- [ ] Filha 1", "\t- [x] Filha 2"].join("\n"));
  });
});
