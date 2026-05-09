"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Loader2,
  RadioTower,
  ShieldCheck,
  Target,
  XCircle,
} from "lucide-react";
import MapView from "@/components/MapView";
import concessionsData from "@/data/concessions.json";
import projectsData from "@/data/public_companies.json";
import sourcePacksData from "@/data/source_packs.json";
import { getNearbyProjects } from "@/lib/geo";
import { sourcePackToFact } from "@/lib/evidence";
import type {
  Concession,
  EvidenceItem,
  PublicCompanyProject,
  SourcePack,
} from "@/lib/types";

const concessions = concessionsData as Concession[];
const projects = projectsData as PublicCompanyProject[];
const sourcePacks = sourcePacksData as SourcePack[];

type ReconStep = "idle" | "extracting" | "committee" | "complete" | "error";
type TimelineStatus = "done" | "running" | "pending" | "error";

export default function Workstation() {
  const [selectedId, setSelectedId] = useState(concessions[0].id);
  const [reconStep, setReconStep] = useState<ReconStep>("idle");
  const [liveEvidence, setLiveEvidence] = useState<EvidenceItem[]>([]);
  const [committeeMemo, setCommitteeMemo] = useState("");
  const [reconError, setReconError] = useState("");
  const selected = concessions.find((item) => item.id === selectedId) ?? concessions[0];

  const nearbyProjects = useMemo(
    () => getNearbyProjects(selected, projects),
    [selected],
  );

  const selectedSources = sourcePacks.filter(
    (source) => source.concessionId === selected.id,
  );

  const strongestProject = nearbyProjects[0];
  const selectedCommoditySet = new Set(
    nearbyProjects.flatMap((project) => project.commodities),
  );
  const commodityTape = Array.from(selectedCommoditySet).join(" / ");
  const decision = selected.country === "BW" ? "HOLD" : "GO";
  const liveDecision = getMemoDecision(committeeMemo) ?? decision;
  const confidence = liveEvidence.length > 0 ? "Live" : liveDecision === "GO" ? "High" : "Medium";
  const decisionTone =
    liveDecision === "GO" || liveDecision === "PASS"
      ? "border-[#22c55e]/60 bg-[#22c55e]/15 text-[#b7f7ca]"
      : liveDecision === "NO-GO"
        ? "border-[#ef4444]/60 bg-[#ef4444]/15 text-[#fecaca]"
      : "border-[#f59e0b]/60 bg-[#f59e0b]/15 text-[#ffd48a]";
  const isReconRunning = reconStep === "extracting" || reconStep === "committee";
  const evidenceItems = liveEvidence.length > 0 ? liveEvidence : selectedSources.map(sourcePackToEvidence);

  function selectConcession(id: string) {
    setSelectedId(id);
    setReconStep("idle");
    setLiveEvidence([]);
    setCommitteeMemo("");
    setReconError("");
  }

  async function runRecon() {
    setReconStep("extracting");
    setReconError("");
    setCommitteeMemo("");

    try {
      const evidenceResponse = await fetch("/api/extract-evidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concession: selected,
          projects: nearbyProjects,
          sourcePacks: selectedSources,
          braveResults: [],
        }),
      });

      if (!evidenceResponse.ok) {
        throw new Error(await responseError(evidenceResponse, "Evidence extraction failed"));
      }

      const evidencePayload = (await evidenceResponse.json()) as {
        evidence?: EvidenceItem[];
        error?: string;
      };
      const extractedEvidence =
        evidencePayload.evidence && evidencePayload.evidence.length > 0
          ? evidencePayload.evidence
          : selectedSources.map(sourcePackToEvidence);

      setLiveEvidence(extractedEvidence);
      setReconStep("committee");

      const committeeResponse = await fetch("/api/investment-committee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concession: selected,
          projects: nearbyProjects,
          evidence: extractedEvidence,
          braveResults: [],
        }),
      });

      if (!committeeResponse.ok) {
        throw new Error(await responseError(committeeResponse, "Committee memo failed"));
      }

      await streamCommitteeMemo(committeeResponse, setCommitteeMemo);
      setReconStep("complete");
    } catch (error) {
      setReconStep("error");
      setReconError(error instanceof Error ? error.message : "Recon failed");
    }
  }

  return (
    <main className="flex h-screen min-w-[1024px] overflow-hidden bg-[#07090d] text-[#f4f7fb]">
      <section className="relative h-full min-w-0 basis-[68%] border-r border-[#2a3140]">
        <MapView
          concessions={concessions}
          selected={selected}
          projects={nearbyProjects}
          sources={selectedSources}
          onSelect={selectConcession}
        />
        <div className="absolute left-4 right-4 top-4 z-10 max-w-[760px]">
          <div className="workstation-panel border border-[#2a3140] bg-[#10141c]/95 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-5 border-b border-[#2a3140] px-4 py-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8c96a8]">
                  GPT-5.5 Mining Analyst
                </p>
                <h1 className="mt-1 text-[20px] font-bold leading-6 text-[#f4f7fb]">
                  Concession Recon
                </h1>
              </div>
              <div className={`shrink-0 rounded-md border px-3 py-2 text-center ${decisionTone}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                  Chair Decision
                </p>
                <p className="text-sm font-bold">{liveDecision}</p>
              </div>
            </div>
            <div className="grid grid-cols-[1.2fr_0.8fr] gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#f5c542]">
                  {selected.name}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#b7c0d0]">
                  {selected.country} block under 100km public-disclosure scan.
                  {strongestProject
                    ? ` Closest public comparator: ${strongestProject.project}.`
                    : " No public comparator loaded."}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MapStat label="Radius" value="100km" />
                <MapStat label="Projects" value={nearbyProjects.length.toString()} />
                <MapStat label="Sources" value={selectedSources.length.toString()} />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-4 left-4 z-10 flex max-w-[520px] flex-wrap gap-2">
          <MapLegend color="#f5c542" label="Selected concession" />
          <MapLegend color="#d98b4a" label="Public project" />
          <MapLegend color="#4a90e2" label="Evidence pin" />
        </div>
      </section>

      <aside className="flex h-full min-w-[390px] basis-[32%] flex-col overflow-y-auto bg-[#10141c]">
        <div className="border-b border-[#2a3140] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8c96a8]">
                Selected Concession
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-[#f4f7fb]">
                {selected.name}
              </p>
            </div>
            <span className="shrink-0 rounded border border-[#4a90e2]/40 bg-[#4a90e2]/10 px-2 py-1 font-mono text-xs text-[#9cc6ff]">
              {commodityTape || "Multi"} district
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {concessions.map((concession) => (
              <button
                key={concession.id}
                onClick={() => selectConcession(concession.id)}
                className={`min-w-0 rounded-lg border px-3 py-2 text-left text-sm transition ${
                  selected.id === concession.id
                    ? "border-[#f5c542] bg-[#f5c542]/15 text-[#f5c542]"
                    : "border-[#2a3140] bg-[#171c26] text-[#d5dbea] hover:border-[#4a90e2]"
                }`}
              >
                <span className="block truncate font-semibold">{concession.name}</span>
                <span className="mt-1 block font-mono text-xs text-[#8c96a8]">
                  {concession.country} / 100km recon
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 p-4">
          <button
            onClick={runRecon}
            disabled={isReconRunning}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#f5c542] px-4 text-sm font-semibold text-[#07090d] transition hover:bg-[#ffd66b] disabled:cursor-not-allowed disabled:bg-[#8c7a38]"
          >
            {isReconRunning ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileSearch size={16} />
            )}
            {isReconRunning ? "Running Recon" : "Run Recon"}
          </button>
          {reconError ? (
            <div className="rounded-md border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-xs leading-5 text-[#fecaca]">
              {reconError}
            </div>
          ) : null}

          <section className="workstation-panel border border-[#2a3140] bg-[#171c26]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RadioTower size={15} className="text-[#f5c542]" />
                <h2 className="text-sm font-semibold">Recon Timeline</h2>
              </div>
              <span className="font-mono text-xs text-[#8c96a8]">cached + live</span>
            </div>
            <div className="mt-3 space-y-2">
              {getTimelineItems(
                reconStep,
                nearbyProjects.length,
                selectedSources.length,
                evidenceItems.length,
              ).map((item, index) => (
                <div key={item.label} className="flex items-center gap-3 rounded-md bg-[#10141c]/70 px-3 py-2">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${timelineTone(item.status)}`}>
                    {item.status === "running" ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : item.status === "error" ? (
                      <XCircle size={12} />
                    ) : (
                      <CheckCircle2 size={12} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[#f4f7fb]">{item.label}</p>
                    <p className="truncate font-mono text-xs text-[#8c96a8]">
                      {index + 1}. {item.meta}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="workstation-panel border border-[#2a3140] bg-[#171c26]">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-[#d98b4a]" />
              <h2 className="text-sm font-semibold">Nearby Public Projects</h2>
            </div>
            <div className="mt-3 space-y-2">
              {nearbyProjects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-md border border-[#2a3140] bg-[#10141c] px-3 py-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{project.project}</p>
                      <p className="truncate font-mono text-xs text-[#8c96a8]">
                        {project.company} / {project.exchange}:{project.ticker}
                      </p>
                    </div>
                    <span className="shrink-0 rounded border border-[#4a90e2]/40 bg-[#4a90e2]/10 px-2 py-1 font-mono text-xs text-[#9cc6ff]">
                      {project.distanceKm}km
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {project.commodities.map((commodity) => (
                      <span
                        key={commodity}
                        className="rounded border border-[#2a3140] px-1.5 py-0.5 font-mono text-[11px] text-[#b7c0d0]"
                      >
                        {commodity}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="workstation-panel border border-[#2a3140] bg-[#171c26]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Activity size={16} className="shrink-0 text-[#4a90e2]" />
                <h2 className="truncate text-sm font-semibold">Evidence Extraction</h2>
              </div>
              <span className="shrink-0 font-mono text-xs text-[#8c96a8]">
                {evidenceItems.length} citations
              </span>
            </div>
            <div className="mt-3 divide-y divide-[#2a3140] overflow-hidden rounded-md border border-[#2a3140]">
              {evidenceItems.map((evidence) => (
                <a
                  key={evidence.id}
                  href={evidence.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-[#10141c] px-3 py-3 transition hover:bg-[#121824]"
                >
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-semibold">{evidence.project}</p>
                        <span className="shrink-0 rounded border border-[#2a3140] px-1.5 py-0.5 font-mono text-[11px] text-[#8c96a8]">
                          {evidence.company}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#b7c0d0]">
                        {evidence.summary}
                      </p>
                    </div>
                    <span className={`h-fit rounded border px-2 py-1 font-mono text-xs ${confidenceTone(evidence.confidence)}`}>
                      {evidence.confidence}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-2 text-xs text-[#8c96a8]">
                    <span className="rounded border border-[#4a90e2]/30 bg-[#4a90e2]/10 px-1.5 py-0.5 font-mono text-[#9cc6ff]">
                      {evidence.evidenceType.replaceAll("_", " ")}
                    </span>
                    <span className="truncate font-mono">{evidence.sourceTitle}</span>
                    <ExternalLink size={12} className="shrink-0 text-[#8c96a8]" />
                  </div>
                </a>
              ))}
            </div>
          </section>

          <section className="workstation-panel border border-[#2a3140] bg-[#171c26]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="shrink-0 text-[#f5c542]" />
                  <h2 className="truncate text-sm font-semibold">Investment Committee</h2>
                </div>
                <p className="mt-1 text-xs text-[#8c96a8]">
                  Decision memo from public evidence proximity.
                </p>
              </div>
              <div className={`shrink-0 rounded-md border px-3 py-2 text-center ${decisionTone}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                  Decision
                </p>
                <p className="text-base font-bold">{liveDecision}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <DecisionMetric label="Confidence" value={confidence} />
              <DecisionMetric label="Sources" value={evidenceItems.length.toString()} />
              <DecisionMetric label="Projects" value={nearbyProjects.length.toString()} />
            </div>
            {committeeMemo ? (
              <div className="mt-4 rounded-md border border-[#2a3140] bg-[#10141c] px-3 py-3">
                <div className="whitespace-pre-wrap text-xs leading-5 text-[#d5dbea]">
                  {committeeMemo}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2 text-sm leading-6 text-[#d5dbea]">
                <MemoRow
                  label="Bull Case"
                  text="Nearby public evidence shows active capital, defined resources, and operating or development momentum in the district."
                />
                <MemoRow
                  label="Bear Case"
                  text="The current read is proximity-based. Direct concession geology, license standing, and field validation remain unresolved."
                />
                <MemoRow
                  label="Key Unknowns"
                  text="Confirm tenure status, comparable stratigraphy, target access, and whether disclosed mineralization trends plausibly continue into the block."
                />
                <MemoRow
                  label="30-Day Diligence Plan"
                  text="Verify license standing, map comparable geology, call operator IR teams, and prioritize direct field evidence inside the concession."
                />
              </div>
            )}
            <div className="mt-4 rounded-md border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-2">
              <div className="flex gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#f5c542]" />
                <p className="text-xs leading-5 text-[#ffd48a]">
                  Chair rationale: proceed only after source-backed title and
                  geology checks tie the public evidence to the selected block.
                </p>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </main>
  );
}

function MapStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[#2a3140] bg-[#07090d]/70 px-2 py-2">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.04em] text-[#8c96a8]">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-xs font-semibold text-[#f4f7fb]">
        {value}
      </p>
    </div>
  );
}

function MapLegend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-[#2a3140] bg-[#10141c]/90 px-2.5 py-1.5 text-xs text-[#b7c0d0] backdrop-blur">
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{label}</span>
    </div>
  );
}

function DecisionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[#2a3140] bg-[#10141c] px-2 py-2">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.04em] text-[#8c96a8]">
        {label}
      </p>
      <p className="mt-1 truncate font-mono text-xs font-semibold text-[#f4f7fb]">
        {value}
      </p>
    </div>
  );
}

function MemoRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-[#2a3140] bg-[#10141c] px-3 py-2">
      <p className="text-xs font-bold uppercase tracking-[0.04em] text-[#f5c542]">
        {label}
      </p>
      <p className="mt-1 text-xs leading-5 text-[#d5dbea]">{text}</p>
    </div>
  );
}

function sourcePackToEvidence(source: SourcePack): EvidenceItem {
  return {
    id: `cached-${source.id}`,
    sourceUrl: source.sourceUrl,
    sourceTitle: source.sourceTitle,
    company: source.company,
    project: source.project,
    date: source.retrievedAt,
    evidenceType: "corporate_activity",
    summary: sourcePackToFact(source),
    extractedFacts: {},
    confidence: "medium",
  };
}

async function responseError(response: Response, fallback: string) {
  const text = await response.text();
  return text.trim() || fallback;
}

async function streamCommitteeMemo(
  response: Response,
  setMemo: (memo: string) => void,
) {
  if (!response.body) {
    setMemo(await response.text());
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let memo = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    memo += decoder.decode(value, { stream: true });
    setMemo(memo);
  }

  memo += decoder.decode();
  setMemo(memo);
}

function getMemoDecision(memo: string) {
  const match = memo.match(/\b(NO-GO|PASS|GO|HOLD)\b/i);
  return match?.[1].toUpperCase();
}

function getTimelineItems(
  step: ReconStep,
  projectCount: number,
  sourceCount: number,
  evidenceCount: number,
) {
  const extractionStatus: TimelineStatus =
    step === "extracting"
      ? "running"
      : step === "idle"
        ? "pending"
        : step === "error"
          ? "error"
          : "done";
  const committeeStatus: TimelineStatus =
    step === "committee"
      ? "running"
      : step === "complete"
        ? "done"
        : step === "error"
          ? "error"
          : "pending";

  return [
    {
      label: "Finding nearby projects",
      meta: `${projectCount} projects`,
      status: "done" as TimelineStatus,
    },
    {
      label: "Searching public disclosures",
      meta: `${sourceCount} cached sources`,
      status: "done" as TimelineStatus,
    },
    {
      label: "Extracting drilling evidence",
      meta: step === "idle" ? `${sourceCount} sources` : `${evidenceCount} evidence items`,
      status: extractionStatus,
    },
    {
      label: "Running investment committee",
      meta: "GPT-5.5",
      status: committeeStatus,
    },
  ];
}

function timelineTone(status: TimelineStatus) {
  switch (status) {
    case "done":
      return "border-[#22c55e]/50 bg-[#22c55e]/10 text-[#86efac]";
    case "running":
      return "border-[#f5c542]/50 bg-[#f5c542]/10 text-[#f5c542]";
    case "error":
      return "border-[#ef4444]/50 bg-[#ef4444]/10 text-[#fecaca]";
    default:
      return "border-[#4a5568] bg-[#10141c] text-[#8c96a8]";
  }
}

function confidenceTone(confidence: EvidenceItem["confidence"]) {
  switch (confidence) {
    case "high":
      return "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#86efac]";
    case "low":
      return "border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#ffd48a]";
    default:
      return "border-[#4a90e2]/40 bg-[#4a90e2]/10 text-[#9cc6ff]";
  }
}
