import { TFile, type Vault } from "obsidian";
import type { CascadeSettings } from "../config/schema";

const TASK_RE = /^(\s*)- \[([^\]])\]/;
const COMPLETE = "x";
const OPEN = " ";
const COMPLETABLE = new Set([" ", "/"]);
const UNCHECK_ON_PARENT_OPEN = new Set(["x", "/"]);

interface ParsedTask {
  index: number;
  indent: number;
  status: string;
  text: string;
}

export class TaskFamilyService {
  private timers = new Map<string, number>();
  private snapshots = new Map<string, string>();
  private writing = new Set<string>();

  constructor(
    private readonly vault: Vault,
    private readonly settings: CascadeSettings,
  ) {}

  async prime(): Promise<void> {
    const files = this.vault.getMarkdownFiles();
    await Promise.all(
      files.map(async (file) => {
        try {
          this.snapshots.set(file.path, await this.vault.read(file));
        } catch (error) {
          if (!isMissingFileError(error)) throw error;
        }
      }),
    );
  }

  schedule(file: TFile): void {
    if (!this.settings.autoCompleteTaskFamilies || file.extension !== "md" || this.writing.has(file.path)) return;
    window.clearTimeout(this.timers.get(file.path));
    const timer = window.setTimeout(() => {
      void this.reconcile(file);
      this.timers.delete(file.path);
    }, 250);
    this.timers.set(file.path, timer);
  }

  private async reconcile(file: TFile): Promise<void> {
    if (this.writing.has(file.path)) return;
    if (!this.vault.getAbstractFileByPath(file.path)) return;
    let before = "";
    try {
      before = await this.vault.read(file);
    } catch (error) {
      if (isMissingFileError(error)) return;
      throw error;
    }
    const previous = this.snapshots.get(file.path);
    const after = reconcileTaskFamilies(before, previous);
    this.snapshots.set(file.path, after);
    if (before === after) return;
    this.writing.add(file.path);
    try {
      await this.vault.modify(file, after);
    } finally {
      this.writing.delete(file.path);
    }
  }
}

export function reconcileTaskFamilies(content: string, previousContent = ""): string {
  const lines = String(content || "").split(/\r?\n/);
  let changed = false;

  const tasks = parseTasks(lines);
  const previousTasks = parseTasks(String(previousContent || "").split(/\r?\n/));
  const skipParentCompletion = new Set<number>();
  const skipDescendantUncheck = new Set<number>();

  for (const task of tasks) {
    if (task.status !== COMPLETE) continue;
    const previous = previousTaskFor(previousTasks, task);
    if (previous?.status !== COMPLETE) continue;
    const children = descendantTasks(tasks, task);
    if (
      !children.some((child) => {
        if (!COMPLETABLE.has(child.status)) return false;
        const previousChild = previousTaskFor(previousTasks, child);
        return !previousChild || previousChild.status === COMPLETE;
      })
    ) {
      continue;
    }
    lines[task.index] = withStatus(lines[task.index], OPEN);
    task.status = OPEN;
    skipParentCompletion.add(task.index);
    skipDescendantUncheck.add(task.index);
    changed = true;
  }

  for (const task of tasks) {
    if (skipDescendantUncheck.has(task.index)) continue;
    if (!COMPLETABLE.has(task.status)) continue;
    const previous = previousTaskFor(previousTasks, task);
    if (previous?.status !== COMPLETE) continue;
    const children = descendantTasks(tasks, task);
    if (!children.length) continue;
    for (const child of children) {
      if (!UNCHECK_ON_PARENT_OPEN.has(child.status)) continue;
      lines[child.index] = withStatus(lines[child.index], OPEN);
      child.status = OPEN;
      changed = true;
    }
    skipParentCompletion.add(task.index);
  }

  for (const task of tasks) {
    if (task.status !== COMPLETE) continue;
    for (const child of descendantTasks(tasks, task)) {
      if (!COMPLETABLE.has(child.status)) continue;
      lines[child.index] = withStatus(lines[child.index], COMPLETE);
      child.status = COMPLETE;
      changed = true;
    }
  }

  for (let index = tasks.length - 1; index >= 0; index -= 1) {
    const task = tasks[index];
    if (!COMPLETABLE.has(task.status)) continue;
    const children = directChildTasks(tasks, task);
    if (!children.length) continue;

    const allComplete = children.every((child) => child.status === COMPLETE);
    const anyComplete = children.some((child) => child.status === COMPLETE);
    const anyInProgress = children.some((child) => child.status === "/");

    let targetStatus = task.status;
    if (allComplete) {
      if (!skipParentCompletion.has(task.index)) {
        targetStatus = COMPLETE;
      }
    } else if (anyComplete || anyInProgress) {
      targetStatus = "/";
    } else {
      targetStatus = OPEN;
    }

    if (task.status !== targetStatus) {
      lines[task.index] = withStatus(lines[task.index], targetStatus);
      task.status = targetStatus;
      changed = true;
    }
  }

  return changed ? lines.join("\n") : content;
}

function parseTasks(lines: string[]): ParsedTask[] {
  return lines.flatMap((line, index) => {
    const match = line.match(TASK_RE);
    if (!match) return [];
    return [{ index, indent: match[1].length, status: match[2], text: line.replace(TASK_RE, "").trim() }];
  });
}

function previousTaskFor(previousTasks: ParsedTask[], task: ParsedTask): ParsedTask | undefined {
  return previousTasks.find((previous) => previous.indent === task.indent && previous.text === task.text);
}

function descendantTasks(tasks: ParsedTask[], parent: ParsedTask): ParsedTask[] {
  const descendants: ParsedTask[] = [];
  const start = tasks.findIndex((task) => task.index === parent.index);
  for (let index = start + 1; index < tasks.length; index += 1) {
    if (tasks[index].indent <= parent.indent) break;
    descendants.push(tasks[index]);
  }
  return descendants;
}

function directChildTasks(tasks: ParsedTask[], parent: ParsedTask): ParsedTask[] {
  const descendants = descendantTasks(tasks, parent);
  const firstIndent = descendants.find((task) => task.indent > parent.indent)?.indent;
  if (firstIndent === undefined) return [];
  return descendants.filter((task) => task.indent === firstIndent);
}

function withStatus(line: string, status: string): string {
  return line.replace(/^(\s*)- \[[^\]]\]/, `$1- [${status}]`);
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && /ENOENT|no such file/i.test(error.message);
}
