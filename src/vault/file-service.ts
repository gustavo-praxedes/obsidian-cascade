import { TFile, normalizePath, type Vault } from "obsidian";

export class FileService {
  constructor(private readonly vault: Vault) {}

  async read(path: string): Promise<string> {
    const file = this.getFile(path);
    return file ? this.vault.read(file) : "";
  }

  async write(path: string, content: string): Promise<TFile> {
    const normalized = normalizePath(path);
    await this.ensureFolder(parentFolder(normalized));
    const file = this.getFile(normalized);
    if (file) {
      await this.vault.modify(file, content);
      return file;
    }
    return this.vault.create(normalized, content);
  }

  async append(path: string, content: string): Promise<void> {
    const current = await this.read(path);
    await this.write(path, current ? `${current}\n${content}` : content);
  }

  async ensureFolder(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (!normalized || this.vault.getAbstractFileByPath(normalized)) return;
    const parts = normalized.split("/");
    let cursor = "";
    for (const part of parts) {
      cursor = cursor ? `${cursor}/${part}` : part;
      if (!this.vault.getAbstractFileByPath(cursor)) {
        await this.vault.createFolder(cursor);
      }
    }
  }

  async ensureFile(path: string, content: string): Promise<TFile> {
    const file = this.getFile(path);
    if (file) return file;
    return this.write(path, content);
  }

  exists(path: string): boolean {
    return Boolean(this.getFile(path));
  }

  findMarkdownByBasenamePrefix(prefix: string): TFile | null {
    return this.vault.getMarkdownFiles().find((file) => file.basename.startsWith(prefix)) ?? null;
  }

  getFile(path: string): TFile | null {
    const abstract = this.vault.getAbstractFileByPath(normalizePath(path));
    return abstract instanceof TFile ? abstract : null;
  }
}

export function parentFolder(path: string): string {
  const parts = normalizePath(path).split("/");
  parts.pop();
  return parts.join("/");
}
