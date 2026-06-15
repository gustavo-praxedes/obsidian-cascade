import { TFile, type EventRef, type Vault } from "obsidian";
import { FrontmatterService } from "../notes/frontmatter-service";
import { NormalizerService } from "../notes/normalizer-service";
import { ScheduledTaskService } from "../tasks/scheduled-task-service";
import { TaskFamilyService } from "../tasks/task-family-service";

export class EventRegistry {
  private refs: EventRef[] = [];

  constructor(
    private readonly vault: Vault,
    private readonly normalizer: NormalizerService,
    private readonly frontmatter: FrontmatterService,
    private readonly taskFamilies: TaskFamilyService,
    private readonly scheduledTasks: ScheduledTaskService,
  ) {}

  register(): void {
    this.refs.push(
      this.vault.on("create", (file) => {
        if (file instanceof TFile) {
          void this.normalizer.normalizeFile(file);
          void this.frontmatter.initialize(file);
        }
      }),
      this.vault.on("modify", (file) => {
        if (file instanceof TFile) {
          this.frontmatter.schedule(file);
          this.taskFamilies.schedule(file);
          this.scheduledTasks.schedule(file);
        }
      }),
    );
  }

  unregister(): void {
    for (const ref of this.refs) this.vault.offref(ref);
    this.refs = [];
  }
}
