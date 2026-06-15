import type { CascadeSettings, StatusDef } from "../config/schema";

export class StatusService {
  constructor(private readonly settings: CascadeSettings) {}

  all(): StatusDef[] {
    return [...this.settings.essentialStatuses, ...this.settings.customStatuses];
  }

  menuStatuses(): StatusDef[] {
    return [...this.settings.essentialStatuses, ...this.settings.customStatuses.filter((status) => status.showInMenu !== false)];
  }

  get(symbol: string): StatusDef | undefined {
    return this.all().find((status) => status.symbol === symbol);
  }

  validate(status: StatusDef): string | null {
    if (!status.symbol) return "Status symbol is required.";
    if (status.symbol.length !== 1) return "Status symbol must be one character.";
    if (this.settings.essentialStatuses.some((item) => item.symbol === status.symbol && !status.essential)) {
      return "Status symbol is protected.";
    }
    return null;
  }

  withCustom(statuses: StatusDef[]): CascadeSettings {
    const seen = new Set(this.settings.essentialStatuses.map((status) => status.symbol));
    const customStatuses = statuses.filter((status) => {
      if (seen.has(status.symbol)) return false;
      seen.add(status.symbol);
      return true;
    });
    return { ...this.settings, customStatuses };
  }
}
