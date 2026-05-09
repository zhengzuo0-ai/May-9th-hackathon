import { NextResponse } from "next/server";
import type {
  Concession,
  EvidenceItem,
  PublicCompanyProject,
} from "@/lib/types";
import type { BraveSearchResult } from "@/lib/brave";
import { generateText, hasOpenAIKey } from "@/lib/openai";
import { analystSystemPrompt, buildFollowUpPrompt } from "@/lib/prompts";

type FollowUpRequest = {
  question?: unknown;
  preset?: unknown;
  concession?: Concession;
  projects?: PublicCompanyProject[];
  evidence?: EvidenceItem[];
  braveResults?: BraveSearchResult[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FollowUpRequest;
    const question = normalizeQuestion(body);
    const input = {
      question,
      concession: body.concession,
      projects: body.projects ?? [],
      evidence: body.evidence ?? [],
      braveResults: body.braveResults ?? [],
    };

    if (!hasOpenAIKey() || isPresetQuestion(question)) {
      return NextResponse.json({ answer: fallbackFollowUp(question, input.evidence) });
    }

    const answer = await generateText(
      buildFollowUpPrompt(input),
      analystSystemPrompt,
    );

    return NextResponse.json({ answer });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Follow-up failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeQuestion(body: FollowUpRequest) {
  if (typeof body.question === "string" && body.question.trim()) {
    return body.question.trim();
  }

  if (typeof body.preset === "string" && body.preset.trim()) {
    return body.preset.trim();
  }

  return "What should we verify first?";
}

function isPresetQuestion(question: string) {
  return [
    "What should we verify first?",
    "Which layer is weakest?",
    "Which nearby companies matter most?",
    "What is the 30-day field plan?",
  ].includes(question);
}

function fallbackFollowUp(question: string, evidence: EvidenceItem[]) {
  const topEvidence = evidence.slice(0, 3);

  switch (question) {
    case "What should we verify first?":
      return [
        "Verify these items first:",
        ...topEvidence.map(
          (item) => `- ${item.summary} Source: ${item.sourceTitle}.`,
        ),
        "- Confirm package license status and boundaries against official cadastre records.",
        "- Separate direct package evidence from nearby same-trend comparables and regional context.",
      ].join("\n");
    case "Which layer is weakest?":
      return [
        weakestLayerAnswer(evidence),
        "",
        "Use the weak layer to define the next work order before spending time on broader narrative polish.",
      ].join("\n");
    case "Which nearby companies matter most?":
      return [
        "Nearby company priority:",
        ...rankCompanies(evidence).map(
          ([company, count]) => `- ${company}: ${count} extracted evidence item(s).`,
        ),
        "- Start with companies that disclose resource, drilling, operating mine, or development-stage facts; treat proximity-only references as context.",
      ].join("\n");
    case "What is the 30-day field plan?":
      return [
        "30-day field + data plan:",
        "- Week 1: verify cadastre status, package coordinates, access, and public-company comparable locations.",
        "- Week 2: interpret remote-sensing disturbance, ASM/workings, drainage, and structural targets.",
        "- Week 3: field-check priority sites, collect reconnaissance samples, and log access constraints.",
        "- Week 4: reconcile assay/geology observations with public evidence and update the expert evidence package.",
      ].join("\n");
    default:
      return [
        "I can answer from the extracted package evidence once an OpenAI API key is configured.",
        "",
        ...topEvidence.map((item) => `- ${item.summary} Source: ${item.sourceTitle}.`),
      ].join("\n");
  }
}

function weakestLayerAnswer(evidence: EvidenceItem[]) {
  const layers: Array<[string, EvidenceItem["evidenceType"][]]> = [
    ["remote sensing", ["remote_sensing"]],
    ["ASM / workings / trenching", ["asm_activity", "trenching"]],
    ["public company drilling or resources", ["drilling_result", "resource_estimate"]],
    ["geochemistry", ["geochemistry"]],
    ["geophysics", ["geophysics"]],
    ["cadastre", ["cadastre", "license_activity"]],
  ];

  const layerCounts = layers.map(([label, types]) => [
    label,
    evidence.filter((item) => types.includes(item.evidenceType)).length,
  ] as const);
  const [weakestLabel, weakestCount] = layerCounts.sort((a, b) => a[1] - b[1])[0];

  return `Weakest layer: ${weakestLabel} (${weakestCount} extracted item(s)).`;
}

function rankCompanies(evidence: EvidenceItem[]) {
  const counts = new Map<string, number>();

  for (const item of evidence) {
    if (!item.company) {
      continue;
    }

    counts.set(item.company, (counts.get(item.company) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return ranked.length > 0 ? ranked.slice(0, 5) : [["No company evidence yet", 0] as const];
}
