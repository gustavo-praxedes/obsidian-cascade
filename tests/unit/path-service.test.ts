import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/config/defaults";
import { PathService, normalizeText, titleSlug } from "../../src/notes/path-service";

describe("PathService", () => {
  it("renders daily, monthly and yearly paths from configurable formats", () => {
    const service = new PathService(DEFAULT_SETTINGS);
    const date = new Date(2026, 5, 15);

    expect(service.dailyBase(date)).toBe("202606150000-SEGUNDA-FEIRA");
    expect(service.monthlyBase(date)).toBe("202606000000-JUNHO");
    expect(service.annualBase(date)).toBe("202600000000-2026");
    expect(service.dailyPath(date)).toBe("01-AGENDA/2026/06/202606150000-SEGUNDA-FEIRA.md");
    expect(service.renderDailyLog(date)).toContain("# 15 - SEGUNDA-FEIRA");
    expect(service.renderMonthlyLog(date)).toContain("[[01-AGENDA/2026/06/202606150000-SEGUNDA-FEIRA|15 - SEGUNDA-FEIRA]]");
  });

  it("normalizes accents and produces stable title slugs", () => {
    expect(normalizeText("SÁBADO [[path|Árvore]]")).toBe("SABADO [[path|Arvore]]");
    expect(titleSlug("ação crítica")).toBe("AÇÃO-CRÍTICA");
  });

  it("extracts dates from daily titles", () => {
    const service = new PathService(DEFAULT_SETTINGS);
    expect(service.dateFromDailyTitle("202606150000-SEGUNDA")?.toISOString().slice(0, 10)).toBe("2026-06-15");
  });
});
