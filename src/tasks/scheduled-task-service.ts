import { Notice, TFile, type App } from "obsidian";
import { toOpenTask } from "./task-serializer";

const TASK_RE = /^(\s*)- \[([^\]])\]\s+(.*)$/;

export class ScheduledTaskService {
  constructor(private readonly app: App) {}

  async copyFromActiveFile(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!(file instanceof TFile) || file.extension !== "md") {
      new Notice("Cascade: nenhuma nota Markdown ativa.");
      return;
    }

    await this.process(file);
  }

  private async process(file: TFile): Promise<void> {
    if (!this.app.vault.getAbstractFileByPath(file.path)) return;
    let content = "";
    try {
      content = await this.app.vault.read(file);
    } catch (error) {
      if (isMissingFileError(error)) return;
      throw error;
    }
    const scheduled = scheduledRootTasks(content);
    if (!scheduled.length) {
      new Notice("Cascade: nenhuma tarefa agendada encontrada na nota atual.");
      return;
    }

    await copyText(scheduled[0].clipboardText);
    new Notice("Cascade: tarefa agendada copiada. Cole no log superior.");
    await this.openUpperLog(content);
  }

  private async openUpperLog(content: string): Promise<void> {
    const path = upperLogPath(content);
    if (!path) return;
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return;
    await this.app.workspace.getLeaf(false).openFile(file);
  }
}

export function scheduledRootTasks(content: string): Array<{ key: string; clipboardText: string }> {
  const lines = String(content || "").split(/\r?\n/);
  const result: Array<{ key: string; clipboardText: string }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(TASK_RE);
    if (!match || match[1].length !== 0 || match[2] !== "<" || !match[3].trim()) continue;
    const block = [toOpenTask(lines[index])];
    for (let next = index + 1; next < lines.length; next += 1) {
      const child = lines[next];
      if (!child.trim()) break;
      const childMatch = child.match(TASK_RE);
      if (childMatch && childMatch[1].length <= match[1].length) break;
      if (/^\s+/.test(child)) block.push(child);
    }
    result.push({ key: normalizeKey(lines[index]), clipboardText: block.join("\n") });
  }

  return result;
}

export function upperLogPath(content: string): string | null {
  const match = String(content || "").match(/^log:\s*["']?\[\[([^|\]]+)/m);
  return match ? `${match[1]}.md` : null;
}

async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

function normalizeKey(line: string): string {
  return line.replace(/^-\s+\[[^\]]\]\s+/, "").replace(/\s+/g, " ").trim().toUpperCase();
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && /ENOENT|no such file/i.test(error.message);
}
