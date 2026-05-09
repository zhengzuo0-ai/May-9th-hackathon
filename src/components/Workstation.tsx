"use client";

import { type ReactNode, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Landmark,
  Loader2,
  MapPin,
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
type DataRoomRole = "all" | "geology" | "remote" | "commercial" | "institutional";
type EvidenceFilter = "all" | EvidenceItem["evidenceType"];
type SourceCategory = "public_company" | "public_paper" | "institutional";
type SourceCard = {
  source: SourcePack;
  evidenceType: EvidenceItem["evidenceType"];
  category: SourceCategory;
  categoryLabel: string;
  roles: DataRoomRole[];
};

export default function Workstation() {
  const [selectedId, setSelectedId] = useState(concessions[0].id);
  const [reconStep, setReconStep] = useState<ReconStep>("idle");
  const [liveEvidence, setLiveEvidence] = useState<EvidenceItem[]>([]);
  const [committeeMemo, setCommitteeMemo] = useState("");
  const [reconError, setReconError] = useState("");
  const [dataRoomRole, setDataRoomRole] = useState<DataRoomRole>("all");
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>("all");
  const selected = concessions.find((item) => item.id === selectedId) ?? concessions[0];

  const nearbyProjects = useMemo(
    () => getNearbyProjects(selected, projects),
    [selected],
  );

  const selectedSources = sourcePacks.filter(
    (source) => source.concessionId === selected.id,
  );

  const closestMapAnchor = nearbyProjects[0];
  const selectedCommoditySet = new Set(
    nearbyProjects.flatMap((project) => project.commodities),
  );
  const commodityTape = Array.from(selectedCommoditySet).join(" / ");
  const isReconRunning = reconStep === "extracting" || reconStep === "committee";
  const evidenceItems = liveEvidence.length > 0 ? liveEvidence : selectedSources.map(sourcePackToEvidence);
  const sourceCards = useMemo(
    () => selectedSources.map((source) => buildSourceCard(source)),
    [selectedSources],
  );
  const filteredSourceCards = useMemo(
    () =>
      sourceCards.filter(
        (card) => dataRoomRole === "all" || card.roles.includes(dataRoomRole),
      ),
    [dataRoomRole, sourceCards],
  );
  const evidenceTypeOptions = useMemo(
    () => buildEvidenceTypeOptions(evidenceItems),
    [evidenceItems],
  );
  const visibleEvidenceItems = useMemo(
    () =>
      evidenceItems.filter(
        (item) => evidenceFilter === "all" || item.evidenceType === evidenceFilter,
      ),
    [evidenceFilter, evidenceItems],
  );
  const sourceCardByUrl = useMemo(
    () => new Map(sourceCards.map((card) => [card.source.sourceUrl, card])),
    [sourceCards],
  );
  const sourceMix = buildSourceMix(sourceCards);
  const sourceCompanyCount = new Set(selectedSources.map((source) => source.company)).size;
  const defaultRoute =
    evidenceItems.length >= 4 && sourceCompanyCount >= 2
      ? "PRIORITIZE"
      : evidenceItems.length >= 2
        ? "WATCH"
        : "DEFER";
  const liveRoute = getMemoRoute(committeeMemo) ?? defaultRoute;
  const confidence = liveEvidence.length > 0 ? "Live" : liveRoute === "PRIORITIZE" ? "High" : "Medium";
  const decisionTone =
    liveRoute === "PRIORITIZE"
      ? "border-[#22c55e]/60 bg-[#22c55e]/15 text-[#b7f7ca]"
      : liveRoute === "DEFER"
        ? "border-[#ef4444]/60 bg-[#ef4444]/15 text-[#fecaca]"
      : "border-[#f59e0b]/60 bg-[#f59e0b]/15 text-[#ffd48a]";
  const layerStack = buildLayerStack(
    nearbyProjects.length,
    selectedSources.length,
    evidenceItems,
  );
  const dataRoomRows = buildDataRoomRows(
    nearbyProjects.length,
    selectedSources,
    evidenceItems,
  );

  function selectConcession(id: string) {
    setSelectedId(id);
    setReconStep("idle");
    setLiveEvidence([]);
    setCommitteeMemo("");
    setReconError("");
    setDataRoomRole("all");
    setEvidenceFilter("all");
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
        throw new Error(await responseError(committeeResponse, "Expert review route failed"));
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
                  Public + Remote Evidence Analyst
                </p>
                <h1 className="mt-1 text-[20px] font-bold leading-6 text-[#f4f7fb]">
                  West Africa AOI Intelligence
                </h1>
              </div>
              <div className={`shrink-0 rounded-md border px-3 py-2 text-center ${decisionTone}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                  AOI Triage
                </p>
                <p className="text-sm font-bold">{liveRoute}</p>
              </div>
            </div>
            <div className="grid grid-cols-[1.2fr_0.8fr] gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#f5c542]">
                  {selected.name}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#b7c0d0]">
                  {selected.country} AOI under 150km focused public + remote evidence scan.
                  {closestMapAnchor
                    ? ` Closest map anchor: ${closestMapAnchor.project}.`
                    : " No public comparator loaded."}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <MapStat label="Radius" value="150km" />
                <MapStat label="Anchors" value={nearbyProjects.length.toString()} />
                <MapStat label="Sources" value={selectedSources.length.toString()} />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-4 left-4 z-10 flex max-w-[520px] flex-wrap gap-2">
          <MapLegend color="#ff1f1f" label="Red: selected AOI" />
          <MapLegend color="#d98b4a" label="Orange: public project" />
          <MapLegend color="#22d3ee" label="Cyan: ASM / disturbance" />
          <MapLegend color="#4a90e2" label="Blue: cited source" />
        </div>
      </section>

      <aside className="flex h-full min-w-[390px] basis-[32%] flex-col overflow-y-auto bg-[#10141c]">
        <div className="border-b border-[#2a3140] px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8c96a8]">
                Selected AOI
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
                  {concession.country} / 150km recon
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
            {isReconRunning ? "Running AOI Recon" : "Run AOI Recon"}
          </button>
          {reconError ? (
            <div className="rounded-md border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-xs leading-5 text-[#fecaca]">
              {reconError}
            </div>
          ) : null}

          <section className="workstation-panel border border-[#2a3140] bg-[#171c26]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <MapPin size={16} className="shrink-0 text-[#f5c542]" />
                <h2 className="truncate text-sm font-semibold">Map Pin Read</h2>
              </div>
              <span className="shrink-0 font-mono text-xs text-[#8c96a8]">
                right panel key
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              <PinGuide
                color="#ff1f1f"
                label="Red AOI"
                text="The concession being triaged by this panel."
              />
              <PinGuide
                color="#d98b4a"
                label="Orange project"
                text="Public-company comparator, useful when the same belt or trend is plausible."
              />
              <PinGuide
                color="#22d3ee"
                label="Cyan ASM"
                text="Artisanal mining, disturbance, or remote-sensing study anchor for field verification."
              />
              <PinGuide
                color="#4a90e2"
                label="Blue source"
                text="A citation-backed evidence point from the Data Room."
              />
            </div>
            <div className="mt-3 rounded-md border border-[#f5c542]/30 bg-[#f5c542]/10 px-3 py-2 text-xs leading-5 text-[#ffe39b]">
              Same shear zone or mineralized trend fit carries more weight than raw distance;
              kilometers only rank where to inspect first.
            </div>
          </section>

          <section className="workstation-panel border border-[#2a3140] bg-[#171c26]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Activity size={16} className="shrink-0 text-[#4a90e2]" />
                <h2 className="truncate text-sm font-semibold">Data Coverage</h2>
              </div>
              <span className="shrink-0 font-mono text-xs text-[#8c96a8]">
                layer stack
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {layerStack.map((layer) => (
                <div
                  key={layer.label}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-[#2a3140] bg-[#10141c] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#f4f7fb]">
                      {layer.label}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-[#8c96a8]">
                      {layer.meta}
                    </p>
                  </div>
                  <span className={`rounded border px-2 py-1 font-mono text-xs ${layer.tone}`}>
                    {layer.value}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="workstation-panel border border-[#2a3140] bg-[#171c26]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileSearch size={16} className="shrink-0 text-[#f5c542]" />
                <h2 className="truncate text-sm font-semibold">Research Library / Data Room</h2>
              </div>
              <span className="shrink-0 font-mono text-xs text-[#8c96a8]">
                {filteredSourceCards.length} visible
              </span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <SourceMixStat
                icon={<Building2 size={13} />}
                label="Public co."
                value={sourceMix.publicCompany.toString()}
              />
              <SourceMixStat
                icon={<BookOpen size={13} />}
                label="Papers"
                value={sourceMix.publicPaper.toString()}
              />
              <SourceMixStat
                icon={<Landmark size={13} />}
                label="Gov / inst."
                value={sourceMix.institutional.toString()}
              />
            </div>
            <div className="mt-3 grid gap-1.5">
              {dataRoomRows.map((row) => (
                <button
                  key={row.label}
                  onClick={() => setDataRoomRole(row.role)}
                  className={`grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
                    dataRoomRole === row.role
                      ? "border-[#f5c542]/70 bg-[#f5c542]/10"
                      : "border-[#2a3140] bg-[#10141c] hover:border-[#4a90e2]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-[#f4f7fb]">
                      {row.label}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] leading-4 text-[#8c96a8]">
                      {row.meta}
                    </p>
                  </div>
                  <span className={`rounded border px-2 py-1 font-mono text-xs ${row.tone}`}>
                    {row.value}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 divide-y divide-[#2a3140] overflow-hidden rounded-md border border-[#2a3140]">
              {filteredSourceCards.slice(0, 4).map((card) => (
                <a
                  key={card.source.id}
                  href={card.source.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-[#10141c] px-3 py-2 transition hover:bg-[#121824]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#f4f7fb]">
                        {card.source.sourceTitle}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[11px] text-[#8c96a8]">
                        {card.source.company} / {formatEvidenceType(card.evidenceType)}
                      </p>
                    </div>
                    <ExternalLink size={12} className="mt-0.5 shrink-0 text-[#8c96a8]" />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[11px] ${sourceCategoryTone(card.category)}`}>
                      {card.categoryLabel}
                    </span>
                    <span className="rounded border border-[#4a90e2]/30 bg-[#4a90e2]/10 px-1.5 py-0.5 font-mono text-[11px] text-[#9cc6ff]">
                      blue evidence pin
                    </span>
                  </div>
                </a>
              ))}
              {filteredSourceCards.length === 0 ? (
                <div className="bg-[#10141c] px-3 py-3 text-xs text-[#8c96a8]">
                  No sources in this role for the selected AOI.
                </div>
              ) : null}
            </div>
            {filteredSourceCards.length > 4 ? (
              <p className="mt-2 font-mono text-[11px] text-[#8c96a8]">
                +{filteredSourceCards.length - 4} more sources in this filtered shelf
              </p>
            ) : null}
          </section>

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
              <h2 className="text-sm font-semibold">Nearby Map Anchors</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#8c96a8]">
              Orange pins are company anchors; cyan pins are ASM / remote-sensing disturbance anchors; green pins are institutional sources. Treat distance as a prompt;
              prioritize projects on the same shear zone, belt, or mineralized trend.
            </p>
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
                      orange / {project.distanceKm}km
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
                <h2 className="truncate text-sm font-semibold">Public + Remote Evidence</h2>
              </div>
              <span className="shrink-0 font-mono text-xs text-[#8c96a8]">
                {visibleEvidenceItems.length}/{evidenceItems.length} citations
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#8c96a8]">
              Blue pins are source-backed citations. The analyst read is trend fit first,
              distance second.
            </p>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {evidenceTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setEvidenceFilter(option.value)}
                  className={`shrink-0 rounded-md border px-2 py-1 font-mono text-[11px] transition ${
                    evidenceFilter === option.value
                      ? "border-[#4a90e2] bg-[#4a90e2]/20 text-[#b9dcff]"
                      : "border-[#2a3140] bg-[#10141c] text-[#8c96a8] hover:border-[#4a90e2]"
                  }`}
                >
                  {option.label} {option.count}
                </button>
              ))}
            </div>
            <div className="mt-3 divide-y divide-[#2a3140] overflow-hidden rounded-md border border-[#2a3140]">
              {visibleEvidenceItems.map((evidence) => {
                const sourceCard = sourceCardByUrl.get(evidence.sourceUrl);

                return (
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
                    <div className="mt-2 grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 text-xs text-[#8c96a8]">
                      <span className="rounded border border-[#4a90e2]/30 bg-[#4a90e2]/10 px-1.5 py-0.5 font-mono text-[#9cc6ff]">
                        {formatEvidenceType(evidence.evidenceType)}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 font-mono ${sourceCategoryTone(sourceCard?.category ?? "public_company")}`}>
                        {sourceCard?.categoryLabel ?? "Public company"}
                      </span>
                      <span className="truncate font-mono">{evidence.sourceTitle}</span>
                      <ExternalLink size={12} className="shrink-0 text-[#8c96a8]" />
                    </div>
                  </a>
                );
              })}
              {visibleEvidenceItems.length === 0 ? (
                <div className="bg-[#10141c] px-3 py-3 text-xs text-[#8c96a8]">
                  No evidence items match this filter.
                </div>
              ) : null}
            </div>
          </section>

          <section className="workstation-panel border border-[#2a3140] bg-[#171c26]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="shrink-0 text-[#f5c542]" />
                  <h2 className="truncate text-sm font-semibold">Expert Review Route</h2>
                </div>
                <p className="mt-1 text-xs text-[#8c96a8]">
                  AI prepares the evidence route; specialists make the technical and commercial judgment.
                </p>
              </div>
              <div className={`shrink-0 rounded-md border px-3 py-2 text-center ${decisionTone}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                  AOI Triage
                </p>
                <p className="text-base font-bold">{liveRoute}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <DecisionMetric label="Confidence" value={confidence} />
              <DecisionMetric label="Sources" value={evidenceItems.length.toString()} />
              <DecisionMetric label="Anchors" value={nearbyProjects.length.toString()} />
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
                  label="Expert Collaboration Model"
                  text="The app packages public data for geologist, remote-sensing, and commercial teams; it does not replace expert judgment."
                />
                <MemoRow
                  label="Geology / Geochemistry / Geophysics"
                  text="Use regional geology, soil or stream geochemistry, geophysics, and public drilling/resource analogues to decide which targets deserve field verification."
                />
                <MemoRow
                  label="Remote Sensing / ASM Read"
                  text="Cached layers flag disturbance and possible workings as prompts for verification, not standalone proof of mineralization."
                />
                <MemoRow
                  label="Missing Data"
                  text="Confirm tenure status, local geology, structure, target access, and whether disclosed mineralized trends plausibly continue into the AOI."
                />
                <MemoRow
                  label="30-Day Expert Workplan"
                  text="Geologist checks structure and sampling logic; remote-sensing team screens disturbance and access; commercial team builds counterparties and source library."
                />
              </div>
            )}
            <div className="mt-4 rounded-md border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-2">
              <div className="flex gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#f5c542]" />
                <p className="text-xs leading-5 text-[#ffd48a]">
                  AI triage is not a final decision. Prioritize only after expert
                  review ties title, geology, remote evidence, and field checks to the selected AOI.
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

function SourceMixStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-[#2a3140] bg-[#10141c] px-2 py-2">
      <div className="flex items-center gap-1.5 text-[#8c96a8]">
        <span className="shrink-0">{icon}</span>
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.04em]">
          {label}
        </p>
      </div>
      <p className="mt-1 truncate font-mono text-xs font-semibold text-[#f4f7fb]">
        {value}
      </p>
    </div>
  );
}

function PinGuide({
  color,
  label,
  text,
}: {
  color: string;
  label: string;
  text: string;
}) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2 rounded-md border border-[#2a3140] bg-[#10141c] px-3 py-2">
      <span
        className="mt-1 h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-[#f4f7fb]">{label}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-[#8c96a8]">{text}</p>
      </div>
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
    evidenceType: inferEvidenceType(source),
    summary: sourcePackToFact(source),
    extractedFacts: {},
    confidence: "medium",
  };
}

function inferEvidenceType(source: SourcePack): EvidenceItem["evidenceType"] {
  const text = `${source.sourceTitle} ${source.text}`.toLowerCase();

  if (text.includes("research library") || text.includes("paper") || text.includes("study")) {
    return "research_paper";
  }

  if (text.includes("remote") || text.includes("satellite") || text.includes("disturbance")) {
    return "remote_sensing" as EvidenceItem["evidenceType"];
  }

  if (text.includes("asm") || text.includes("artisanal") || text.includes("pit")) {
    return "asm_activity" as EvidenceItem["evidenceType"];
  }

  if (text.includes("cadastre") || text.includes("license") || text.includes("licence")) {
    return "license_activity";
  }

  if (text.includes("resource") || text.includes("reserve")) {
    return "resource_estimate";
  }

  if (text.includes("drill") || text.includes("trench")) {
    return "drilling_result";
  }

  return "corporate_activity";
}

function buildSourceCard(source: SourcePack): SourceCard {
  const evidenceType = inferEvidenceType(source);
  const category = inferSourceCategory(source);
  const roles = new Set<DataRoomRole>();

  if (
    [
      "drilling_result",
      "resource_estimate",
      "geochemistry",
      "geophysics",
      "research_paper",
      "infrastructure",
    ].includes(evidenceType)
  ) {
    roles.add("geology");
  }

  if (["remote_sensing", "asm_activity", "trenching"].includes(evidenceType)) {
    roles.add("remote");
  }

  if (
    category === "public_company" ||
    ["corporate_activity", "license_activity", "cadastre", "infrastructure"].includes(evidenceType)
  ) {
    roles.add("commercial");
  }

  if (category === "institutional" || ["license_activity", "cadastre"].includes(evidenceType)) {
    roles.add("institutional");
  }

  if (roles.size === 0) {
    roles.add("commercial");
  }

  return {
    source,
    evidenceType,
    category,
    categoryLabel: sourceCategoryLabel(category),
    roles: Array.from(roles),
  };
}

function inferSourceCategory(source: SourcePack): SourceCategory {
  const text = `${source.company} ${source.sourceTitle} ${source.sourceType}`.toLowerCase();

  if (
    source.sourceType === "research_paper" ||
    /journal|university|paper|study|scientific|science direct|sciencedirect/.test(text)
  ) {
    return "public_paper";
  }

  if (
    /world bank|eiti|geological survey|geosurvey|ministry|government|cadastre|forest watch|institution|sodemi|usgs|landfolio/.test(text)
  ) {
    return "institutional";
  }

  return "public_company";
}

function buildEvidenceTypeOptions(items: EvidenceItem[]) {
  const counts = new Map<EvidenceItem["evidenceType"], number>();

  items.forEach((item) => {
    counts.set(item.evidenceType, (counts.get(item.evidenceType) ?? 0) + 1);
  });

  return [
    { value: "all" as EvidenceFilter, label: "All", count: items.length },
    ...Array.from(counts.entries())
      .sort(([first], [second]) => formatEvidenceType(first).localeCompare(formatEvidenceType(second)))
      .map(([value, count]) => ({
        value,
        label: formatEvidenceType(value),
        count,
      })),
  ];
}

function buildSourceMix(sourceCards: SourceCard[]) {
  return {
    publicCompany: sourceCards.filter((card) => card.category === "public_company").length,
    publicPaper: sourceCards.filter((card) => card.category === "public_paper").length,
    institutional: sourceCards.filter((card) => card.category === "institutional").length,
  };
}

function formatEvidenceType(type: EvidenceItem["evidenceType"]) {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function sourceCategoryLabel(category: SourceCategory) {
  switch (category) {
    case "public_paper":
      return "Public paper";
    case "institutional":
      return "Gov / survey / institution";
    default:
      return "Public company";
  }
}

function sourceCategoryTone(category: SourceCategory) {
  switch (category) {
    case "public_paper":
      return "border-[#22c55e]/35 bg-[#22c55e]/10 text-[#a7f3d0]";
    case "institutional":
      return "border-[#f5c542]/35 bg-[#f5c542]/10 text-[#ffe39b]";
    default:
      return "border-[#d98b4a]/35 bg-[#d98b4a]/10 text-[#ffd1ad]";
  }
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

function getMemoRoute(memo: string) {
  const match = memo.match(/\b(PRIORITIZE|WATCH|DEFER)\b/i);
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
      label: "Finding public projects",
      meta: `${projectCount} projects`,
      status: "done" as TimelineStatus,
    },
    {
      label: "Reading public + remote evidence",
      meta: `${sourceCount} cached sources`,
      status: "done" as TimelineStatus,
    },
    {
      label: "Classifying AOI evidence",
      meta: step === "idle" ? `${sourceCount} sources` : `${evidenceCount} evidence items`,
      status: extractionStatus,
    },
    {
      label: "Drafting expert review route",
      meta: "GPT-5.5",
      status: committeeStatus,
    },
  ];
}

function buildLayerStack(
  projectCount: number,
  sourceCount: number,
  evidenceItems: EvidenceItem[],
) {
  const countTypes = (types: string[]) =>
    evidenceItems.filter((item) => types.includes(item.evidenceType)).length;
  const remoteSignals = countTypes(["remote_sensing"]);
  const asmSignals = countTypes(["asm_activity", "trenching"]);
  const geologySignals = countTypes([
    "drilling_result",
    "resource_estimate",
    "geochemistry",
    "geophysics",
    "research_paper",
    "infrastructure",
  ]);
  const dataGaps = Math.max(1, 4 - Math.min(4, remoteSignals + asmSignals + geologySignals));
  const goodTone = "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#86efac]";
  const watchTone = "border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#ffd48a]";
  const infoTone = "border-[#4a90e2]/40 bg-[#4a90e2]/10 text-[#9cc6ff]";

  return [
    {
      label: "Map anchors",
      value: projectCount.toString(),
      meta: "company, ASM, and institution pins",
      tone: projectCount > 0 ? goodTone : watchTone,
    },
    {
      label: "Source packs",
      value: sourceCount.toString(),
      meta: "cached public-source excerpts",
      tone: sourceCount > 0 ? infoTone : watchTone,
    },
    {
      label: "Remote sensing",
      value: remoteSignals > 0 ? remoteSignals.toString() : "queued",
      meta: "disturbance and alteration screen",
      tone: remoteSignals > 0 ? goodTone : watchTone,
    },
    {
      label: "ASM / pits",
      value: asmSignals > 0 ? asmSignals.toString() : "field",
      meta: "workings and disturbance checks",
      tone: asmSignals > 0 ? goodTone : watchTone,
    },
    {
      label: "Geology / structure",
      value: geologySignals > 0 ? geologySignals.toString() : "belt",
      meta: "Birimian context and trend fit",
      tone: geologySignals > 0 ? goodTone : infoTone,
    },
    {
      label: "Data gaps",
      value: dataGaps.toString(),
      meta: "items to close before staking",
      tone: dataGaps <= 1 ? infoTone : watchTone,
    },
  ];
}

function buildDataRoomRows(
  projectCount: number,
  sources: SourcePack[],
  evidenceItems: EvidenceItem[],
) {
  const sourceCards = sources.map((source) => buildSourceCard(source));
  const sourceText = (source: SourcePack) =>
    `${String(source.sourceType)} ${source.sourceTitle} ${source.text}`.toLowerCase();
  const technicalLinks = sources.filter((source) =>
    /technical|report|study|paper|presentation|resource|geology|structure/.test(sourceText(source)),
  ).length;
  const remoteSignals = evidenceItems.filter((item) =>
    ["remote_sensing", "asm_activity", "trenching"].includes(item.evidenceType),
  ).length;
  const geologySignals = evidenceItems.filter((item) =>
    ["drilling_result", "resource_estimate", "geochemistry", "geophysics", "research_paper"].includes(item.evidenceType),
  ).length;
  const institutionalSources = sourceCards.filter((card) =>
    card.roles.includes("institutional"),
  ).length;
  const goodTone = "border-[#22c55e]/40 bg-[#22c55e]/10 text-[#86efac]";
  const watchTone = "border-[#f59e0b]/40 bg-[#f59e0b]/10 text-[#ffd48a]";
  const infoTone = "border-[#4a90e2]/40 bg-[#4a90e2]/10 text-[#9cc6ff]";

  return [
    {
      role: "all" as DataRoomRole,
      label: "All source shelf",
      value: sources.length.toString(),
      meta: "companies, papers, government and institutional sources",
      tone: sources.length > 0 ? infoTone : watchTone,
    },
    {
      role: "geology" as DataRoomRole,
      label: "Geologist workspace",
      value: geologySignals > 0 ? geologySignals.toString() : "review",
      meta: "drilling, resources, geology, and structure notes",
      tone: geologySignals > 0 ? goodTone : infoTone,
    },
    {
      role: "remote" as DataRoomRole,
      label: "Remote Sensing workspace",
      value: remoteSignals > 0 ? remoteSignals.toString() : "screen",
      meta: "disturbance, ASM/pits, and imagery-derived checks",
      tone: remoteSignals > 0 ? goodTone : watchTone,
    },
    {
      role: "commercial" as DataRoomRole,
      label: "Commercial workspace",
      value: projectCount.toString(),
      meta: "public-company comparables and disclosure links",
      tone: projectCount > 0 ? goodTone : watchTone,
    },
    {
      role: "institutional" as DataRoomRole,
      label: "Gov / survey / institution shelf",
      value: institutionalSources > 0 ? institutionalSources.toString() : "check",
      meta: `${technicalLinks} technical links; cadastre, survey, and institution checks`,
      tone: institutionalSources > 0 ? infoTone : watchTone,
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
