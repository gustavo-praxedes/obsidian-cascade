import type { CascadeLanguage } from "../config/schema";
import { enUS } from "./en-US";
import { ptBR } from "./pt-BR";

type Messages = typeof enUS;
type MessageKey = keyof Messages;

const dictionaries: Record<Exclude<CascadeLanguage, "auto">, Messages> = {
  "en-US": enUS,
  "pt-BR": ptBR,
};

export class I18n {
  private language: Exclude<CascadeLanguage, "auto">;

  constructor(language: CascadeLanguage) {
    this.language = language === "auto" ? this.detectLanguage() : language;
  }

  t(key: MessageKey): string {
    return dictionaries[this.language][key] ?? enUS[key] ?? key;
  }

  tArray(key: MessageKey): string[] {
    return this.t(key).split(",").map((s) => s.trim());
  }

  private detectLanguage(): Exclude<CascadeLanguage, "auto"> {
    const locale = window.localStorage.getItem("language") ?? navigator.language;
    return locale.toLowerCase().startsWith("pt") ? "pt-BR" : "en-US";
  }
}
