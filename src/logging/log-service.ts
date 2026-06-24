import type { CascadeSettings } from "../config/schema";
import type { FileService } from "../vault/file-service";

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogCategory {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
}

const MS_PER_DAY = 86_400_000;

export class LogService {
  readonly startup: LogCategory;
  readonly migration: LogCategory;
  readonly normalizer: LogCategory;

  private buffer: string[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly settings: CascadeSettings,
    private readonly files: FileService,
  ) {
    this.startup = this.createCategory("loggingStartup");
    this.migration = this.createCategory("loggingMigration");
    this.normalizer = this.createCategory("loggingNormalizer");
  }

  info(message: string): void {
    this.write("info", message);
  }

  warn(message: string): void {
    this.write("warn", message);
  }

  error(message: string): void {
    if (this.settings.loggingEnabled && this.settings.loggingErrors) {
      this.write("error", message);
    }
  }

  debug(message: string): void {
    this.write("debug", message);
  }

  private createCategory(settingKey: "loggingStartup" | "loggingMigration" | "loggingNormalizer"): LogCategory {
    return {
      info: (msg) => this.categoryWrite(settingKey, "info", msg),
      warn: (msg) => this.categoryWrite(settingKey, "warn", msg),
      error: (msg) => this.categoryWrite(settingKey, "error", msg),
      debug: (msg) => this.categoryWrite(settingKey, "debug", msg),
    };
  }

  private categoryWrite(settingKey: string, level: LogLevel, message: string): void {
    if (!this.settings.loggingEnabled) return;
    if (!(this.settings as any)[settingKey]) return;
    this.write(level, message);
  }

  private write(level: LogLevel, message: string): void {
    if (!this.settings.loggingEnabled) return;

    const now = new Date();
    const timestamp = this.formatTimestamp(now);
    const icon = levelIcon(level);
    const line = `- ${icon} **${timestamp}** ${message}`;
    this.buffer.push(line);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 500);
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const lines = this.buffer.splice(0);
    const newContent = lines.join("\n");

    try {
      const path = this.logPath();
      const existing = await this.files.read(path);
      const trimmed = this.trimOldEntries(existing);
      const combined = trimmed ? `${trimmed}\n${newContent}` : newContent;
      await this.files.write(path, combined);
    } catch {
      // Silently ignore log write failures to avoid recursive logging
    }
  }

  private logPath(): string {
    const folder = this.settings.loggingFolder?.trim() || "";
    const filename = this.settings.loggingFilename?.trim() || "cascade-log.md";
    if (filename.includes("/")) return filename;
    return folder ? `${folder}/${filename}` : filename;
  }

  private trimOldEntries(content: string): string {
    const retentionDays = this.settings.loggingRetentionDays;
    if (!retentionDays || retentionDays <= 0 || !content) return content;

    const cutoff = Date.now() - retentionDays * MS_PER_DAY;
    const kept: string[] = [];

    for (const line of content.split("\n")) {
      const match = line.match(/\*\*(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})\*\*/);
      if (!match) {
        kept.push(line);
        continue;
      }
      const ts = Date.parse(`${match[1]}T${match[2]}`);
      if (isNaN(ts) || ts >= cutoff) {
        kept.push(line);
      }
    }

    return kept.join("\n").trim();
  }

  private formatTimestamp(date: Date): string {
    const y = date.getFullYear();
    const mo = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const mi = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  }
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function levelIcon(level: LogLevel): string {
  switch (level) {
    case "info":
      return "ℹ️";
    case "warn":
      return "⚠️";
    case "error":
      return "❌";
    case "debug":
      return "🔍";
  }
}
