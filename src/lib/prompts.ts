import type {
  Concession,
  EvidenceItem,
  PublicCompanyProject,
  SourcePack,
} from "@/lib/types";
import type { BraveSearchResult } from "@/lib/brave";

export const analystSystemPrompt =
  "You are an exploration geologist and license-package intelligence analyst. You do not make final investment decisions. Your job is to assemble and triage evidence for expert review by geologists, remote-sensing specialists, and commercial teams. Use only the supplied evidence, distinguish direct facts from inference, and cite source titles or URLs in every material claim.";

export type EvidenceExtractionInput = {
  concession?: Concession;
  projects: PublicCompanyProject[];
  sourcePacks: SourcePack[];
  braveResults: BraveSearchResult[];
};

export type CommitteeInput = {
  concession?: Concession;
  projects: PublicCompanyProject[];
  evidence: EvidenceItem[];
  braveResults: BraveSearchResult[];
};

export type FollowUpInput = CommitteeInput & {
  question: string;
};

export function buildEvidenceExtractionPrompt(input: EvidenceExtractionInput) {
  return [
    "Extract source-backed exploration evidence for the selected license package.",
    "Return strict JSON only with this shape: {\"evidence\":[EvidenceItem]}.",
    "EvidenceItem fields: id, sourceUrl, sourceTitle, company, project, date, evidenceType, summary, extractedFacts, confidence.",
    "Classify evidence using only these evidenceType values: drilling_result, resource_estimate, license_activity, infrastructure, corporate_activity, remote_sensing, asm_activity, geochemistry, geophysics, trenching, cadastre, research_paper.",
    "Classify public company work as drilling_result, resource_estimate, infrastructure, or corporate_activity depending on the fact pattern.",
    "Classify remote sensing, ASM / pits / trenching, geochemistry, geophysics, cadastre / licensing context, and research paper / technical reference evidence explicitly when the source supports it.",
    "Do not treat proximity alone as proof of mineralization. Mark proximity-only signals as low confidence unless supported by drilling, geochemistry, geophysics, resource, or visible workings evidence.",
    "Prefer focused nearby evidence within the license-package district. Regional public-company comparables may come from beyond the immediate package, but distant analogues are context, not direct package evidence.",
    "Prioritize comparables on the same shear zone, greenstone belt, structural corridor, or mineralized trend over closer but unrelated projects.",
    "Rank evidence as: direct package evidence > nearby same-trend public-company / geology / geochemistry / geophysics / ASM evidence > nearby same-country context > distant unrelated analogues.",
    "Prefer concrete facts from sourcePacks. Use braveResults only as weak discovery context.",
    "",
    `License package: ${JSON.stringify(input.concession ?? null)}`,
    `Nearby projects: ${JSON.stringify(input.projects)}`,
    `Source packs: ${JSON.stringify(input.sourcePacks)}`,
    `Brave results: ${JSON.stringify(input.braveResults)}`,
  ].join("\n");
}

export function buildCommitteePrompt(input: CommitteeInput) {
  return [
    "Write an expert-review route in markdown for a Côte d'Ivoire license-package intelligence screen.",
    "Keep it concise, evidence-oriented, and focused on what specialists should verify next.",
    "Do not present the AI as the final decision maker. Frame PRIORITIZE / WATCH / DEFER as triage routing, not an investment decision.",
    "Use exactly these sections:",
    "## Package Triage",
    "Route: PRIORITIZE / WATCH / DEFER",
    "Confidence: High / Medium / Low",
    "",
    "## Why This Package Is Interesting",
    "## Data Package For Experts",
    "## Geology / Geochemistry / Geophysics",
    "## Remote Sensing / ASM / Surface Workings",
    "## Missing Data",
    "## 30-Day Expert Workplan",
    "## What Would Change The Route",
    "Do not invent facts beyond the supplied evidence.",
    "Do not treat proximity alone as proof of mineralization. Separate direct package evidence from regional public-company comparables, and downgrade distant analogues unless geology, structure, or method relevance is clear.",
    "Give extra weight when public-company projects, research papers, ASM workings, or geophysical / geochemical anomalies sit on the same shear zone, structural corridor, greenstone belt, or mineralized trend as the package.",
    "Explicitly separate same-trend evidence from raw-distance evidence.",
    "",
    `License package: ${JSON.stringify(input.concession ?? null)}`,
    `Nearby projects: ${JSON.stringify(input.projects)}`,
    `Evidence: ${JSON.stringify(input.evidence)}`,
    `Brave results: ${JSON.stringify(input.braveResults)}`,
  ].join("\n");
}

export function buildFollowUpPrompt(input: FollowUpInput) {
  return [
    "Answer the user's follow-up for a license-package intelligence and expert collaboration workflow.",
    "Use concise markdown. Ground claims in supplied evidence and cite source titles.",
    "Focus on verification priorities, weakest evidence layers, nearby public companies, research-library links, and a practical 30-day expert workplan when relevant.",
    "",
    `Question: ${input.question}`,
    `License package: ${JSON.stringify(input.concession ?? null)}`,
    `Nearby projects: ${JSON.stringify(input.projects)}`,
    `Evidence: ${JSON.stringify(input.evidence)}`,
    `Brave results: ${JSON.stringify(input.braveResults)}`,
  ].join("\n");
}
