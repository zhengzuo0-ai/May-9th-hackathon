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
      return markdownResponse(fallbackExpertRouteMarkdown(input.evidence));
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
      error instanceof Error ? error.message : "Expert review route failed";
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

function fallbackExpertRouteMarkdown(evidence: EvidenceItem[]) {
  const sourceCompanyCount = new Set(
    evidence.map((item) => item.company).filter(Boolean),
  ).size;
  const resourceItems = evidence.filter(
    (item) => item.evidenceType === "resource_estimate",
  );
  const drillingItems = evidence.filter(
    (item) => item.evidenceType === "drilling_result",
  );
  const remoteSensingItems = evidence.filter(
    (item) => item.evidenceType === "remote_sensing",
  );
  const asmItems = evidence.filter(
    (item) =>
      item.evidenceType === "asm_activity" ||
      item.evidenceType === "trenching",
  );
  const cadastreItems = evidence.filter(
    (item) => item.evidenceType === "cadastre" || item.evidenceType === "license_activity",
  );

  return [
    "## Public Data Snapshot",
    bullet(
      evidence.length > 0
        ? `The evidence stack contains ${evidence.length} source-backed item(s) from ${sourceCompanyCount} source company or organization(s).`
        : "No source-backed evidence has been extracted yet.",
    ),
    bullet(
      resourceItems.length > 0
        ? `${resourceItems.length} resource or reserve disclosure(s) provide district-scale comparability.`
        : "Resource comparability is not yet established from the supplied evidence.",
    ),
    "",
    "## Direct Package Evidence",
    bullet(
      "This package organizes public data for geologist, remote-sensing, and commercial review; it is not a mineralization or investment determination.",
    ),
    bullet(
      `The package currently contains ${evidence.length} item(s), including company disclosures, research references, and remote/ASM context where available.`,
    ),
    "",
    "## Nearby Same-Trend References",
    bullet("Treat nearby public projects as comparables only when structure, belt, method, or trend continuity is plausible from public sources."),
    "",
    "## Geology / Geochemistry / Geophysics",
    bullet(
      drillingItems.length > 0
        ? `${drillingItems.length} drilling disclosure(s) show direct exploration signal in the evidence set.`
        : "No drilling result has been extracted from the supplied evidence.",
    ),
    ...evidence
      .filter((item) =>
        ["drilling_result", "resource_estimate", "infrastructure", "corporate_activity"].includes(
          item.evidenceType,
        ),
      )
      .slice(0, 4)
      .map((item) => bullet(`${item.summary} Source: ${item.sourceTitle}.`)),
    "",
    "## Remote Sensing / ASM / Surface Workings",
    bullet(
      remoteSensingItems.length > 0
        ? `${remoteSensingItems.length} remote-sensing signal(s) are present in the extracted evidence.`
        : "No remote-sensing evidence has been extracted from the supplied sources.",
    ),
    bullet(
      asmItems.length > 0
        ? `${asmItems.length} ASM, workings, or trenching signal(s) should be field checked.`
        : "No ASM, workings, or trenching evidence has been extracted from the supplied sources.",
    ),
    "",
    "## Cadastre / License Context",
    bullet(
      cadastreItems.length > 0
        ? `${cadastreItems.length} cadastre or license-context item(s) should be checked against Landfolio and official records.`
        : "Cadastre status, overlaps, and license standing still need confirmation from official sources.",
    ),
    "",
    "## Missing Data",
    bullet("This public data package cannot prove mineralization inside the license package from proximity alone."),
    bullet("Direct geology, geochemistry, geophysics, license standing, structural trend continuity, and field validation remain gating diligence items."),
    "",
    "## Expert Review Work Queue",
    bullet("Geologist: verify package license status, local geology, shear-zone continuity, alteration, and same-trend target analogues against official maps and public technical reports."),
    bullet("Remote sensing: screen recent disturbance, pits, river impacts, access, and vegetation change before field mobilization."),
    bullet("Commercial: map counterparties, operator disclosures, cadence of news releases, and IR follow-up questions; separate same-trend comparables from distant regional analogues."),
    bullet("Field team: after desktop review, verify workings, access, and candidate sample lines on the ground."),
  ]
    .filter(Boolean)
    .join("\n");
}

function bullet(text: string) {
  return `- ${text}`;
}
