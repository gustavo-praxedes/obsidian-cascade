import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../src/config/defaults";
import { PathService, normalizeText, titleSlug } from "../../src/notes/path-service";

describe("PathService", () => {
  it("renders daily, weekly, monthly and yearly paths from configurable formats", () => {
    const service = new PathService({
      ...DEFAULT_SETTINGS,
      dailyFolder: "Agenda/YYYY/MM",
      weeklyFolder: "Agenda/YYYY",
      monthlyFolder: "Agenda",
      yearlyFolder: "",
    });
    const date = new Date(2026, 5, 15);

    expect(service.dailyBase(date)).toBe("202606150001-SEGUNDA-FEIRA");
    expect(service.weeklyBase(date)).toBe("202606150000-S-25");
    expect(service.monthlyBase(date)).toBe("202606000000-JUNHO");
    expect(service.annualBase(date)).toBe("202600000000-2026");
    
    expect(service.dailyPath(date)).toBe("Agenda/2026/06/202606150001-SEGUNDA-FEIRA.md");
    expect(service.weeklyPath(date)).toBe("Agenda/2026/202606150000-S-25.md");
    expect(service.monthlyPath(date)).toBe("Agenda/202606000000-JUNHO.md");
    expect(service.annualPath(date)).toBe("202600000000-2026.md");
  });

  it("prefixes agenda folders with the agenda root", () => {
    const service = new PathService({
      ...DEFAULT_SETTINGS,
      agendaRoot: "AGENDA",
      dailyFolder: "DIA",
      weeklyFolder: "SEMANA",
      monthlyFolder: "MES",
      yearlyFolder: "ANO",
    });
    const date = new Date(2026, 5, 15);

    expect(service.dailyPath(date)).toBe("AGENDA/DIA/202606150001-SEGUNDA-FEIRA.md");
    expect(service.weeklyPath(date)).toBe("AGENDA/SEMANA/202606150000-S-25.md");
    expect(service.monthlyPath(date)).toBe("AGENDA/MES/202606000000-JUNHO.md");
    expect(service.annualPath(date)).toBe("AGENDA/ANO/202600000000-2026.md");
  });

  it("always prefixes folders with the agenda root even when the folder already includes it", () => {
    const service = new PathService({
      ...DEFAULT_SETTINGS,
      agendaRoot: "AGENDA",
      dailyFolder: "AGENDA/DIA",
    });
    const date = new Date(2026, 5, 15);

    expect(service.dailyPath(date)).toBe("AGENDA/AGENDA/DIA/202606150001-SEGUNDA-FEIRA.md");
  });

  it("orders yearly, monthly, weekly and daily logs on the first day of the year", () => {
    const service = new PathService(DEFAULT_SETTINGS);
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
