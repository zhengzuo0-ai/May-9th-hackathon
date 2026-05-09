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

  return "Verify first";
}

function isPresetQuestion(question: string) {
  return ["Verify first", "Make it PASS", "Compare blocks", "Draft IR email"].includes(
    question,
  );
}

function fallbackFollowUp(question: string, evidence: EvidenceItem[]) {
  const topEvidence = evidence.slice(0, 3);

  switch (question) {
    case "Verify first":
      return [
        "Verify these items first:",
        ...topEvidence.map(
          (item) => `- ${item.summary} Source: ${item.sourceTitle}.`,
        ),
        "- Confirm concession license status and boundaries against official records.",
      ].join("\n");
    case "Make it PASS":
      return [
        "To make this pass an investment committee screen:",
        "- Add direct evidence inside the block, not only nearby analogues.",
        "- Confirm license standing, ownership, and encumbrances.",
        "- Tie target geology to the strongest public comparable.",
      ].join("\n");
    case "Compare blocks":
      return [
        "Comparison frame:",
        `- Evidence density: ${evidence.length} extracted item(s).`,
        `- Projects represented: ${new Set(evidence.map((item) => item.project)).size}.`,
        "- Rank higher when public projects share commodity, host geology, and infrastructure access.",
      ].join("\n");
    case "Draft IR email":
      return [
        "Subject: Follow-up on concession-adjacent public disclosures",
        "",
        "Hi team,",
        "",
        "We are reviewing a nearby concession and would appreciate confirmation of current license standing, recent technical work, and any public reports covering geology, sampling, or drilling in the area.",
        "",
        "Best,",
        "Concession Recon",
      ].join("\n");
    default:
      return [
        "I can answer from the extracted evidence once an OpenAI API key is configured.",
        "",
        ...topEvidence.map((item) => `- ${item.summary} Source: ${item.sourceTitle}.`),
      ].join("\n");
  }
}
