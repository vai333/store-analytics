import { GLOSSARY } from "./glossary";
import type { Role } from "./roles";

const SECTIONS = GLOSSARY.split(/^## /m).filter(Boolean).map((s) => {
  const title = s.split("\n")[0].trim();
  return { title, body: "## " + s.trim(), key: title.toLowerCase() };
});

const METRIC_WORDS: Record<string, string[]> = {
  "metric net sales": ["sales", "revenue", "net", "turnover"],
  "metric gross sales": ["gross", "mrp"],
  "metric units sold": ["unit", "units", "quantity", "sold", "volume"],
  "metric cost of goods": ["cost", "cogs", "goods"],
  "metric margin": ["margin", "profit"],
  "metric average order value": ["average order", "aov", "basket"],
  "metric return rate": ["return"],
};

/** Only the glossary pieces this question and role need. */
export function glossaryFor(question: string, role: Role) {
  const q = question.toLowerCase();
  return SECTIONS.filter((s) => {
    if (s.key.startsWith("table ")) return role.tables.includes(s.key.replace("table ", "") as never);
    if (s.key === "time periods" || s.key === "data caveats") return true;
    return (METRIC_WORDS[s.key] ?? []).some((w) => q.includes(w)) && role.tables.includes("sales");
  }).map((s) => s.body).join("\n\n");
}
