import { TFile, type Vault } from "obsidian";
import type { CascadeSettings } from "../config/schema";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/;
const TASK_RE = /^(\s*)- \[([^\]])\]\s+(.*)$/;
const ROOT_TASK_RE = /^(\s*)-\s+\[([^\]])\]\s+(.*)$/;

export function extractLinkedFileKey(taskText: string): string | null {
  const match = taskText.match(WIKILINK_RE);
  return match ? match[1] : null;
}

export function computeLinkedStatus(linkedContent: string): string | null {
  const tasks = linkedContent
    .split(/\r?\n/)
    .map((line) => line.match(TASK_RE))
    .filter(Boolean);
  if (!tasks.length) return null;
  const statuses = tasks.map((m) => m![2]);
  const allDone = statuses.every((s) => s === "x");
  if (allDone) return "x";
  const anyComplete = statuses.some((s) => s === "x" || s === "/");
  if (anyComplete) return "/";
  return " ";
}

export function reconcileLinkedFiles(
  parentLine: string,
  _linkedFileKey: string,
  linkedContent: string,
): string {
  const newStatus = computeLinkedStatus(linkedContent);
  if (!newStatus) return parentLine;
  return parentLine.replace(/^(\s*)- \[[^\]]\]/, `$1- [${newStatus}]`);
}

export function reconcileAllLinkedFiles(
  content: string,
  linkedFiles: Map<string, string>,
): string {
  const lines = content.split(/\r?\n/);
  let changed = false;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(ROOT_TASK_RE);
    if (!match) continue;
    if (!WIKILINK_RE.test(match[3])) continue;
    const key = extractLinkedFileKey(match[3]);
    if (!key) continue;
    const linkedContent = linkedFiles.get(key);
    if (linkedContent === undefined) continue;
    const newStatus = computeLinkedStatus(linkedContent);
    if (!newStatus || newStatus === match[2]) continue;
    lines[index] = lines[index].replace(
      /^(\s*)- \[[^\]]\]/,
      `$1- [${newStatus}]`,
    );
    changed = true;
  }
  return changed ? lines.join("\n") : content;
}

export function findWikilinkTargets(content: string): Set<string> {
  const keys = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(ROOT_TASK_RE);
    if (!match) continue;
    if (!WIKILINK_RE.test(match[3])) continue;
    const key = extractLinkedFileKey(match[3]);
    if (key) keys.add(key);
  }
  return keys;
}

export class LinkedFileService {
  private timers = new Map<string, number>();
  private snapshots = new Map<string, string>();
  private writing = new Set<string>();

  constructor(
    private readonly vault: Vault,
    private readonly settings: CascadeSettings,
  ) {}

  async prime(): Promise<void> {
    for (const file of this.vault.getMarkdownFiles()) {
      try {
        this.snapshots.set(file.path, await this.vault.read(file));
      } catch (error) {
        if (!isMissingFileError(error)) throw error;
      }
    }
  }

  schedule(file: TFile): void {
    if (!this.settings.linkedFilesEnabled) return;
    if (file.extension !== "md" || this.writing.has(file.path)) return;
    window.clearTimeout(this.timers.get(file.path));
    const timer = window.setTimeout(() => {
      void this.reconcile(file);
      this.timers.delete(file.path);
    }, this.settings.linkedFilesDebounceMs ?? 250);
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
    const after = await this.reconcileContent(file.path, before);
    this.snapshots.set(file.path, after);
    if (before === after) {
      if (previous !== undefined) {
        await this.reconcileParentsOfFile(file, before);
      }
      return;
    }
    this.writing.add(file.path);
    try {
      await this.vault.modify(file, after);
    } finally {
      this.writing.delete(file.path);
      await this.reconcileParentsOfFile(file, after);
    }
  }

  private async reconcileParentsOfFile(
    file: TFile,
    _newContent: string,
  ): Promise<void> {
    const scanRoot = this.settings.linkedFilesScanRoot?.trim() ?? "";
    const allFiles = this.vault.getMarkdownFiles();
    const candidates = scanRoot
      ? allFiles.filter((f) => f.path.startsWith(scanRoot))
      : allFiles;

    for (const candidate of candidates) {
      if (candidate.path === file.path) continue;
      if (this.writing.has(candidate.path)) continue;
      await this.reconcileParentFile(candidate, file.basename);
    }
  }

  private async reconcileParentFile(
    parentFile: TFile,
    targetBasename: string,
  ): Promise<void> {
    let content: string;
    try {
      content = await this.vault.read(parentFile);
    } catch (error) {
      if (isMissingFileError(error)) return;
      throw error;
    }

    const targets = findWikilinkTargets(content);
    if (!targets.has(targetBasename)) return;

    const linkedFiles = new Map<string, string>();
    const filter = this.settings.linkedFilesFilter?.trim() ?? "";
    const scanRoot = this.settings.linkedFilesScanRoot?.trim() ?? "";

    for (const key of targets) {
      if (linkedFiles.has(key)) continue;
      const linkedContent = await this.readLinkedFile(key, parentFile.path, scanRoot);
      if (linkedContent !== null) {
        linkedFiles.set(key, linkedContent);
      }
    }

    if (linkedFiles.size === 0) return;
    const after = reconcileAllLinkedFiles(content, linkedFiles);
    if (content === after) return;

    this.writing.add(parentFile.path);
    this.snapshots.set(parentFile.path, after);
    try {
      await this.vault.modify(parentFile, after);
    } finally {
      this.writing.delete(parentFile.path);
    }
  }

  private async reconcileContent(
    filePath: string,
    content: string,
  ): Promise<string> {
    const lines = content.split(/\r?\n/);
    const hasLinkedTask = lines.some((line) => {
      const match = line.match(ROOT_TASK_RE);
      return match && WIKILINK_RE.test(match[3]);
    });
    if (!hasLinkedTask) return content;

    const filter = this.settings.linkedFilesFilter?.trim() ?? "";
    const scanRoot = this.settings.linkedFilesScanRoot?.trim() ?? "";

    const linkedFiles = new Map<string, string>();
    for (const line of lines) {
      const match = line.match(ROOT_TASK_RE);
      if (!match || !WIKILINK_RE.test(match[3])) continue;
      if (filter && !match[3].includes(filter)) continue;
      const key = extractLinkedFileKey(match[3]);
      if (!key || linkedFiles.has(key)) continue;
      const linkedContent = await this.readLinkedFile(key, filePath, scanRoot);
      if (linkedContent !== null) {
        linkedFiles.set(key, linkedContent);
      }
    }

    if (linkedFiles.size === 0) return content;
    return reconcileAllLinkedFiles(content, linkedFiles);
  }

  private async readLinkedFile(
    key: string,
    fromPath: string,
    scanRoot: string,
  ): Promise<string | null> {
    const file = this.findFileByKey(key, scanRoot);
    if (!file) return null;
    if (file.path === fromPath) return null;
    try {
      return await this.vault.read(file);
    } catch {
      return null;
    }
  }

  private findFileByKey(key: string, scanRoot: string): TFile | null {
    const byPath = this.vault.getAbstractFileByPath(key);
    if (byPath instanceof TFile) return byPath;
    const allFiles = this.vault.getMarkdownFiles();
    const candidates = scanRoot
      ? allFiles.filter((f) => f.path.startsWith(scanRoot))
      : allFiles;
    return candidates.find((f) => f.basename === key) ?? null;
  }
}

function isMissingFileError(error: unknown): boolean {
  return error instanceof Error && /ENOENT|no such file/i.test(error.message);
}
