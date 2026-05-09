import type {
  Concession,
  EvidenceItem,
  PublicCompanyProject,
  SourcePack,
} from "@/lib/types";
import type { BraveSearchResult } from "@/lib/brave";

export const analystSystemPrompt =
  "You are a mining investment analyst. Use only the supplied evidence, distinguish direct facts from inference, and cite source titles or URLs in every material claim.";

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
    "Extract source-backed mining evidence for the selected concession.",
    "Return strict JSON only with this shape: {\"evidence\":[EvidenceItem]}.",
    "EvidenceItem fields: id, sourceUrl, sourceTitle, company, project, date, evidenceType, summary, extractedFacts, confidence.",
    "Use evidenceType values only from drilling_result, resource_estimate, license_activity, infrastructure, corporate_activity.",
    "Prefer concrete facts from sourcePacks. Use braveResults only as weak discovery context.",
    "",
    `Concession: ${JSON.stringify(input.concession ?? null)}`,
    `Nearby projects: ${JSON.stringify(input.projects)}`,
    `Source packs: ${JSON.stringify(input.sourcePacks)}`,
    `Brave results: ${JSON.stringify(input.braveResults)}`,
  ].join("\n");
}

export function buildCommitteePrompt(input: CommitteeInput) {
  return [
    "Write an investment committee memo in markdown for a mining concession recon screen.",
    "Keep it concise and decision-oriented.",
    "Include: decision, bull case, bear case, first diligence actions, and source-backed citations.",
    "Do not invent facts beyond the supplied evidence.",
    "",
    `Concession: ${JSON.stringify(input.concession ?? null)}`,
    `Nearby projects: ${JSON.stringify(input.projects)}`,
    `Evidence: ${JSON.stringify(input.evidence)}`,
    `Brave results: ${JSON.stringify(input.braveResults)}`,
  ].join("\n");
}

export function buildFollowUpPrompt(input: FollowUpInput) {
  return [
    "Answer the user's follow-up for a mining concession recon workflow.",
    "Use concise markdown. Ground claims in supplied evidence and cite source titles.",
    "",
    `Question: ${input.question}`,
    `Concession: ${JSON.stringify(input.concession ?? null)}`,
    `Nearby projects: ${JSON.stringify(input.projects)}`,
    `Evidence: ${JSON.stringify(input.evidence)}`,
    `Brave results: ${JSON.stringify(input.braveResults)}`,
  ].join("\n");
}
