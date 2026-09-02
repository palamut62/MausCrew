import type { MausColor, MausShape } from "./store.ts";

const PROFILES = [
  { match: /research|araştır|investigat|incele|bul\b|web|kaynak/i, name: "Scout", title: "Research Specialist" },
  { match: /design|tasarım|ui\b|ux\b|frontend|onboarding|ekran/i, name: "Pixel", title: "Product Designer" },
  { match: /test|qa\b|doğrula|verify|bug|hata|kalite/i, name: "Sentinel", title: "Quality Engineer" },
  { match: /release|deploy|yayın|ship|installer|exe|sürüm/i, name: "Harbor", title: "Release Manager" },
  { match: /write|yazı|content|içerik|copy|doküman|readme/i, name: "Scribe", title: "Content Specialist" },
  { match: /data|veri|analiz|report|rapor|finance|bütçe/i, name: "Ledger", title: "Data Analyst" },
  { match: /plan|requirement|ürün|product|roadmap|kapsam/i, name: "Atlas", title: "Product Manager" },
] as const;

const COLORS: MausColor[] = ["green", "blue", "red", "orange", "purple", "cyan", "pink", "yellow", "teal", "coral"];
const SHAPES: MausShape[] = ["blob", "pebble", "squircle", "tablet", "wedge", "hex", "cloud", "teardrop"];

function hash(text: string): number {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

export function taskProfile(text: string, existingNames: readonly string[]) {
  const prompt = text.trim().replace(/\s+/g, " ");
  const chosen = PROFILES.find((profile) => profile.match.test(prompt)) ?? {
    name: "Builder",
    title: "Task Specialist",
  };
  const used = new Set(existingNames.map((name) => name.toLocaleLowerCase()));
  let name: string = chosen.name;
  let suffix = 2;
  while (used.has(name.toLocaleLowerCase())) name = `${chosen.name} ${suffix++}`;
  const seed = hash(prompt || chosen.name);
  return {
    name,
    title: chosen.title,
    description: `Owns tasks like: ${prompt.slice(0, 240) || "General delivery"}`,
    color: COLORS[seed % COLORS.length]!,
    shape: SHAPES[seed % SHAPES.length]!,
  };
}
