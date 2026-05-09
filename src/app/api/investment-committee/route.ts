import type {
  Concession,
  EvidenceItem,
  PublicCompanyProject,
} from "@/lib/types";
import type { BraveSearchResult } from "@/lib/brave";
import { hasOpenAIKey, streamText } from "@/lib/openai";
import { analystSystemPrompt, buildCommitteePrompt } from "@/lib/prompts";

type CommitteeRequest = {
  concession?: Concession;
  projects?: PublicCompanyProject[];
  evidence?: EvidenceItem[];
  braveResults?: BraveSearchResult[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CommitteeRequest;
    const input = {
      concession: body.concession,
      projects: body.projects ?? [],
      evidence: body.evidence ?? [],
      braveResults: body.braveResults ?? [],
    };

    if (!hasOpenAIKey()) {
      return markdownResponse(fallbackCommitteeMarkdown(input.evidence));
    }

    const stream = await streamText(buildCommitteePrompt(input), analystSystemPrompt);
    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Investment committee failed";
    return new Response(message, { status: 500 });
  }
}

function markdownResponse(markdown: string) {
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}

function fallbackCommitteeMarkdown(evidence: EvidenceItem[]) {
  const highConfidence = evidence.filter((item) => item.confidence === "high");
  const resourceItems = evidence.filter(
    (item) => item.evidenceType === "resource_estimate",
  );
  const drillingItems = evidence.filter(
    (item) => item.evidenceType === "drilling_result",
  );
  const decision =
    evidence.length >= 4 || resourceItems.length >= 2 ? "GO" : "HOLD";

  return [
    `# Investment Committee: ${decision}`,
    "",
    "## Bull Case",
    bullet(
      evidence.length > 0
        ? `Nearby disclosures provide ${evidence.length} source-backed evidence items across ${new Set(evidence.map((item) => item.project)).size} project(s).`
        : "No source-backed evidence has been extracted yet.",
    ),
    bullet(
      resourceItems.length > 0
        ? `${resourceItems.length} resource or reserve disclosure(s) support district-scale comparability.`
        : "Resource comparability is not yet established from the supplied evidence.",
    ),
    bullet(
      drillingItems.length > 0
        ? `${drillingItems.length} drilling disclosure(s) show direct exploration signal nearby.`
        : "No drilling result has been extracted from the supplied evidence.",
    ),
    "",
    "## Bear Case",
    bullet(
      "The case is proximity-led. It does not prove mineralization inside the selected concession.",
    ),
    bullet(
      "License standing, direct geology, and field validation remain gating diligence items.",
    ),
    "",
    "## First Diligence Actions",
    bullet("Verify license status and coordinates against official cadastre records."),
    bullet("Map comparable geology between the block and cited public projects."),
    bullet("Prioritize direct concession sampling or historical technical reports."),
    "",
    "## Evidence To Verify First",
    ...evidence.slice(0, 4).map((item) =>
      bullet(`${item.summary} Source: ${item.sourceTitle}.`),
    ),
    highConfidence.length > 0
      ? `\nHigh-confidence items: ${highConfidence.length}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function bullet(text: string) {
  return `- ${text}`;
}
