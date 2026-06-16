import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/config/defaults";
import { PathService, normalizeText, titleSlug } from "../../src/notes/path-service";

describe("PathService", () => {
  it("renders daily, weekly, monthly and yearly paths from configurable formats", () => {
    const service = new PathService(DEFAULT_SETTINGS);
    const date = new Date(2026, 5, 15);

    expect(service.dailyBase(date)).toBe("202606150001-SEGUNDA-FEIRA");
    expect(service.weeklyBase(date)).toBe("202606150000-S-25");
    expect(service.monthlyBase(date)).toBe("202606000000-JUNHO");
    expect(service.annualBase(date)).toBe("202600000000-2026");
    expect(service.dailyPath(date)).toBe("01-AGENDA/2026/06/202606150000-S-25/202606150001-SEGUNDA-FEIRA.md");
    expect(service.weeklyPath(date)).toBe("01-AGENDA/2026/06/202606150000-S-25/202606150000-S-25.md");
    expect(service.renderDailyLog(date)).toContain("# 15 - SEGUNDA-FEIRA");
    expect(service.renderDailyLog(date)).toContain('log: "[[01-AGENDA/2026/06/202606150000-S-25/202606150000-S-25|SEMANA 25]]"');
    expect(service.renderWeeklyLog(date)).toContain("[[01-AGENDA/2026/06/202606150000-S-25/202606150001-SEGUNDA-FEIRA|15 - SEGUNDA-FEIRA]]");
    expect(service.renderMonthlyLog(date)).toContain("[[01-AGENDA/2026/06/202606150000-S-25/202606150000-S-25|S-25]]");
  });

  it("renders custom folder names and flat weekly structure", () => {
    const service = new PathService({
      ...DEFAULT_SETTINGS,
      agendaRoot: "PLANEJAMENTO/REGISTROS",
      weeklyStructure: "flat",
    });
    const date = new Date(2026, 5, 16);

    expect(service.weeklyPath(date)).toBe("PLANEJAMENTO/REGISTROS/2026/06/202606150000-S-25.md");
    expect(service.dailyPath(date)).toMatch(/^PLANEJAMENTO\/REGISTROS\/2026\/06\/202606160001-TER.+A-FEIRA\.md$/);
  });

  it("keeps daily notes in the month when weekly notes are disabled", () => {
    const service = new PathService({ ...DEFAULT_SETTINGS, weeklyEnabled: false });
    const date = new Date(2026, 5, 16);

    expect(service.dailyPath(date)).toMatch(/^01-AGENDA\/2026\/06\/202606160001-TER.+A-FEIRA\.md$/);
    expect(service.renderDailyLog(date)).toContain('log: "[[01-AGENDA/2026/06/202606000000-JUNHO|JUNHO]]"');
  });

  it("orders yearly, monthly, weekly and daily logs on the first day of the year", () => {
    const service = new PathService({ ...DEFAULT_SETTINGS, weeklyStructure: "flat" });
    const date = new Date(2026, 0, 1);

    expect([service.annualBase(date), service.monthlyBase(date), service.weeklyBase(date), service.dailyBase(date)]).toEqual([
      "202600000000-2026",
      "202601000000-JANEIRO",
      "202601010000-S-01",
      "202601010001-QUINTA-FEIRA",
    ]);
  });

  it("normalizes accents and produces stable title slugs", () => {
    expect(normalizeText("SABADO [[path|Arvore]]")).toBe("SABADO [[path|Arvore]]");
    expect(titleSlug("acao critica")).toBe("ACAO-CRITICA");
  });

  it("extracts dates from daily titles", () => {
    const service = new PathService(DEFAULT_SETTINGS);
    expect(service.dateFromDailyTitle("202606150001-SEGUNDA")?.toISOString().slice(0, 10)).toBe("2026-06-15");
  });
});
