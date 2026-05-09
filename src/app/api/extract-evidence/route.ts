import { NextResponse } from "next/server";
import type {
  Concession,
  EvidenceItem,
  PublicCompanyProject,
  SourcePack,
} from "@/lib/types";
import type { BraveSearchResult } from "@/lib/brave";
import { generateJson, hasOpenAIKey } from "@/lib/openai";
import {
  analystSystemPrompt,
  buildEvidenceExtractionPrompt,
} from "@/lib/prompts";

type ExtractEvidenceRequest = {
  concession?: Concession;
  projects?: PublicCompanyProject[];
  sourcePacks?: SourcePack[];
  braveResults?: BraveSearchResult[];
};

type ExtractEvidenceInput = {
  concession?: Concession;
  projects: PublicCompanyProject[];
  sourcePacks: SourcePack[];
  braveResults: BraveSearchResult[];
};

type EvidenceResponse = {
  evidence: EvidenceItem[];
  warning?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExtractEvidenceRequest;
    const input = {
      concession: body.concession,
      projects: body.projects ?? [],
      sourcePacks: body.sourcePacks ?? [],
      braveResults: body.braveResults ?? [],
    };

    if (!hasOpenAIKey()) {
      return NextResponse.json({ evidence: fallbackEvidence(input.sourcePacks) });
    }

    const response = await extractWithModel(input);

    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Evidence extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function extractWithModel(input: ExtractEvidenceInput) {
  try {
    return await generateJson<EvidenceResponse>(
      buildEvidenceExtractionPrompt(input),
      analystSystemPrompt,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Model extraction failed";

    return {
      evidence: fallbackEvidence(input.sourcePacks),
      warning: message,
    };
  }
}

function fallbackEvidence(sourcePacks: SourcePack[]): EvidenceItem[] {
  return sourcePacks.map((source) => ({
    id: `evidence-${source.id}`,
    sourceUrl: source.sourceUrl,
    sourceTitle: source.sourceTitle,
    company: source.company,
    project: source.project,
    date: source.retrievedAt,
    evidenceType: inferEvidenceType(source.text),
    summary: firstSentence(source.text),
    extractedFacts: extractFacts(source.text),
    confidence: "medium",
  }));
}

function firstSentence(text: string) {
  const sentence = text.split(". ")[0]?.trim() ?? text.trim();
  return sentence.endsWith(".") ? sentence : `${sentence}.`;
}

function inferEvidenceType(text: string): EvidenceItem["evidenceType"] {
  const normalized = text.toLowerCase();

  if (normalized.includes("drilling") || normalized.includes("metres of")) {
    return "drilling_result";
  }

  if (normalized.includes("resource") || normalized.includes("reserve")) {
    return "resource_estimate";
  }

  if (normalized.includes("mine") || normalized.includes("operation")) {
    return "infrastructure";
  }

  if (normalized.includes("acquisition")) {
    return "corporate_activity";
  }

  return "license_activity";
}

function extractFacts(text: string): EvidenceItem["extractedFacts"] {
  return {
    commodity: commodityFromText(text),
    intercept: text.match(/\d+(?:\.\d+)?\s*metres?/i)?.[0],
    grade: text.match(/\d+(?:\.\d+)?%\s*[A-Za-z0-9]+/i)?.[0],
  };
}

function commodityFromText(text: string) {
  const normalized = text.toLowerCase();

  if (normalized.includes("uranium") || normalized.includes("u3o8")) {
    return "U3O8";
  }

  if (normalized.includes("copper")) {
    return "Cu";
  }

  if (normalized.includes("manganese")) {
    return "Mn";
  }

  if (normalized.includes("nickel")) {
    return "Ni";
  }

  return undefined;
}
