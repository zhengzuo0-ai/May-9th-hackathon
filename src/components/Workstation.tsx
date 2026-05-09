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
  Play,
  RadioTower,
  ShieldCheck,
  Target,
  Upload,
  XCircle,
} from "lucide-react";
import MapView from "@/components/MapView";
import concessionsData from "@/data/concessions.json";
import projectsData from "@/data/public_companies.json";
import sourcePacksData from "@/data/source_packs.json";
import { getNearbyProjects } from "@/lib/geo";
import { sourcePackToFact } from "@/lib/evidence";
import { findPlace, listPlaceNames } from "@/lib/places";
import type {
  Concession,
  EvidenceItem,
  PublicCompanyProject,
  SourcePack,
} from "@/lib/types";

const concessions = concessionsData as Concession[];
const projects = projectsData as PublicCompanyProject[];
const sourcePacks = sourcePacksData as SourcePack[];

type ReconStep = "idle" | "extracting" | "brief" | "complete" | "error";
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
type StaticDemo = {
  id: string;
  label: string;
  meta: string;
  concession: Concession;
};

const intakeSeed = {
  lat: 6.55,
  lng: -5.05,
  name: "Sample point: Yamoussoukro",
};
const intakeSeedText = JSON.stringify(intakeSeed, null, 2);
const staticDemos: StaticDemo[] = [
  {
    id: "static-package",
    label: "Static Result 1",
    meta: "3-license Yaouré–Kokumbo package",
    concession: concessions[0],
  },
  {
    id: "static-point",
    label: "Static Result 2",
    meta: "Coordinate intake result",
    concession: buildPointConcession(
      "static-yamoussoukro-point",
      "Static Yamoussoukro Point Result",
      [-5.05, 6.55],
    ),
  },
];

type WorkstationProps = {
  initialDemoId?: string;
  initialIntakeText?: string;
};

export default function Workstation({
  initialDemoId,
  initialIntakeText,
}: WorkstationProps) {
  const preparedConcessions = useMemo(
    () => [...concessions, staticDemos[1].concession],
    [],
  );
  const initialRuntimeConcession = useMemo(
    () => safeParseIntakeConcession(initialIntakeText),
    [initialIntakeText],
  );
  const [runtimeConcessions, setRuntimeConcessions] = useState<Concession[]>(
    initialRuntimeConcession ? [initialRuntimeConcession] : [],
  );
  const availableConcessions = useMemo(
    () => [...preparedConcessions, ...runtimeConcessions],
    [preparedConcessions, runtimeConcessions],
  );
  const initialSelectedId =
    initialRuntimeConcession?.id ??
    (preparedConcessions.some((item) => item.id === initialDemoId)
      ? initialDemoId
      : concessions[0].id);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const [reconStep, setReconStep] = useState<ReconStep>("idle");
  const [liveEvidence, setLiveEvidence] = useState<EvidenceItem[]>([]);
  const [reconBrief, setReconBrief] = useState("");
  const [reconError, setReconError] = useState("");
  const [dataRoomRole, setDataRoomRole] = useState<DataRoomRole>("all");
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceFilter>("all");
  const [focusedProjectId, setFocusedProjectId] = useState<string>();
  const [intakeText, setIntakeText] = useState(initialIntakeText || intakeSeedText);
  const [intakeError, setIntakeError] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [compareId, setCompareId] = useState(staticDemos[1].concession.id);
  const [headerOpen, setHeaderOpen] = useState(true);
  const selected =
    availableConcessions.find((item) => item.id === selectedId) ?? preparedConcessions[0];
  const isRuntimePackage = selected.id.startsWith("runtime-");
  const compareSelected =
    availableConcessions.find((item) => item.id === compareId && item.id !== selected.id) ??
    availableConcessions.find((item) => item.id !== selected.id) ??
    staticDemos[1].concession;

  const nearbyProjects = useMemo(
    () => getNearbyProjects(selected, projects),
    [selected],
  );
  const compareNearbyProjects = useMemo(
    () => getNearbyProjects(compareSelected, projects),
    [compareSelected],
  );

  const selectedSources = useMemo(() => {
    const raw = sourcePacks.filter((source) => source.concessionId === selected.id);
    return raw.length > 0 ? raw : sourcePacks;
  }, [selected.id]);
  const compareSources = useMemo(() => {
    const raw = sourcePacks.filter((source) => source.concessionId === compareSelected.id);
    return raw.length > 0 ? raw : sourcePacks;
  }, [compareSelected.id]);

  const closestMapAnchor = nearbyProjects[0];
  const selectedCommoditySet = new Set(
    nearbyProjects.flatMap((project) => project.commodities),
  );
  const commodityTape = selectedCommoditySet.has("Au")
    ? "Au + public data package"
    : `${Array.from(selectedCommoditySet).slice(0, 2).join(" / ") || "Multi"} package`;
  const isReconRunning = reconStep === "extracting" || reconStep === "brief";
  const evidenceItems = liveEvidence.length > 0 ? liveEvidence : selectedSources.map(sourcePackToEvidence);
  const compareEvidenceItems = compareSources.map(sourcePackToEvidence);
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
  const compareSourceCards = useMemo(
    () => compareSources.map((source) => buildSourceCard(source)),
    [compareSources],
  );
  const compareSourceMix = buildSourceMix(compareSourceCards);
  const compareDelta = buildCompareDelta({
    left: selected,
    right: compareSelected,
    leftProjects: nearbyProjects,
    rightProjects: compareNearbyProjects,
    leftEvidence: evidenceItems,
    rightEvidence: compareEvidenceItems,
    leftMix: sourceMix,
    rightMix: compareSourceMix,
  });
  const packageStatus = liveEvidence.length > 0 ? "Live package" : "Evidence package";
  const packageStatusTone =
    liveEvidence.length > 0
      ? "border-[#22c55e]/60 bg-[#22c55e]/15 text-[#b7f7ca]"
      : "border-[#4a90e2]/50 bg-[#4a90e2]/12 text-[#b9dcff]";
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
    setReconBrief("");
    setReconError("");
    setDataRoomRole("all");
    setEvidenceFilter("all");
    setFocusedProjectId(undefined);
  }

  function activateStaticDemo(concession: Concession) {
    selectConcession(concession.id);
  }

  async function loadIntakeFile(file?: File) {
    if (!file) return;
    setIntakeText(await file.text());
    setIntakeError("");
  }

  function runIntake() {
    try {
      const concession = parseIntakeConcession(intakeText);
      setRuntimeConcessions((current) => upsertConcession(current, concession));
      selectConcession(concession.id);
      setIntakeError("");
    } catch (error) {
      setIntakeError(error instanceof Error ? error.message : "Could not parse intake JSON");
    }
  }

  function applyPlaceName() {
    const place = findPlace(placeQuery);
    if (!place) {
      setIntakeError(
        `Could not find "${placeQuery.trim() || "place"}" in Côte d'Ivoire. Try: ${listPlaceNames().join(", ")}.`,
      );
      return;
    }
    const json = JSON.stringify(
      { lat: place.lat, lng: place.lng, name: place.name },
      null,
      2,
    );
    setIntakeText(json);
    setIntakeError("");
    try {
      const concession = parseIntakeConcession(json);
      setRuntimeConcessions((current) => upsertConcession(current, concession));
      selectConcession(concession.id);
    } catch (error) {
      setIntakeError(error instanceof Error ? error.message : "Could not parse intake JSON");
    }
  }

  function activateCoverageLayer(label: string) {
    switch (label) {
      case "Map anchors":
        setDataRoomRole("commercial");
        setEvidenceFilter("all");
        setFocusedProjectId(nearbyProjects[0]?.id);
        break;
      case "Source packs":
        setDataRoomRole("all");
        setEvidenceFilter("all");
        break;
      case "Remote sensing":
        setDataRoomRole("remote");
        setEvidenceFilter("remote_sensing");
        break;
      case "ASM / pits":
        setDataRoomRole("remote");
        setEvidenceFilter("asm_activity");
        break;
      case "Geology / structure":
        setDataRoomRole("geology");
        setEvidenceFilter("all");
        break;
      case "Data gaps":
        setDataRoomRole("institutional");
        setEvidenceFilter("license_activity");
        break;
    }
  }

  async function runRecon() {
    setReconStep("extracting");
    setReconError("");
    setReconBrief("");

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
      setReconStep("brief");

      const briefResponse = await fetch("/api/investment-committee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concession: selected,
          projects: nearbyProjects,
          evidence: extractedEvidence,
          braveResults: [],
        }),
      });

      if (!briefResponse.ok) {
        throw new Error(await responseError(briefResponse, "Recon brief failed"));
      }

      await streamReconBrief(briefResponse, setReconBrief);
      setReconStep("complete");
    } catch (error) {
      setReconStep("error");
      setReconError(error instanceof Error ? error.message : "Recon failed");
    }
  }

  return (
    <main className="flex h-screen min-w-[900px] overflow-hidden bg-[#07090d] text-[#f4f7fb]">
      <section className="relative h-full min-w-0 flex-1 border-r border-[#2a3140]">
        <MapView
          concessions={availableConcessions}
          selected={selected}
          projects={nearbyProjects}
          sources={selectedSources}
          focusProjectId={focusedProjectId}
          onSelect={selectConcession}
        />
        <div className="absolute left-4 right-4 top-4 z-10 max-w-[760px]">
          <div className="workstation-panel border border-[#2a3140] bg-[#10141c]/95 shadow-2xl backdrop-blur-md">
            <div className={`flex items-start justify-between gap-5 px-4 py-3 ${headerOpen ? "border-b border-[#2a3140]" : ""}`}>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8c96a8]">
                  Public-Data Intelligence Workbench
                </p>
                <h1 className="mt-1 text-[20px] font-bold leading-6 text-[#f4f7fb]">
                  Concession Recon
                </h1>
              </div>
              <div className="flex shrink-0 items-start gap-2">
                <div className={`rounded-md border px-3 py-2 text-center ${packageStatusTone}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                    Public Data
                  </p>
                  <p className="text-sm font-bold">{evidenceItems.length} sources</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHeaderOpen((open) => !open)}
                  className="rounded-md border border-[#2a3140] bg-[#07090d]/70 px-2 py-2 font-mono text-[10px] text-[#d7deea] transition hover:border-[#4a90e2]"
                >
                  {headerOpen ? "Collapse" : "Expand"}
                </button>
              </div>
            </div>
            {headerOpen ? (
              <>
            <div className="grid grid-cols-[1.2fr_0.8fr] gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#f5c542]">
                  {selected.name}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#b7c0d0]">
                  {selected.country} license package with a 150km public and remote-data scan.
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
            <div className="grid grid-cols-2 gap-2 border-t border-[#2a3140] px-4 py-3">
              {staticDemos.map((demo) => (
                <a
                  key={demo.id}
                  href={`/?demo=${encodeURIComponent(demo.concession.id)}`}
                  onPointerDown={() => activateStaticDemo(demo.concession)}
                  onClick={() => activateStaticDemo(demo.concession)}
                  className={`min-w-0 rounded-md border px-3 py-2 text-left transition ${
                    selected.id === demo.concession.id
                      ? "border-[#f5c542] bg-[#f5c542]/15"
                      : "border-[#2a3140] bg-[#07090d]/70 hover:border-[#4a90e2]"
                  }`}
                >
                  <span className="block text-[10px] font-bold uppercase tracking-[0.04em] text-[#f5c542]">
                    {demo.label}
                  </span>
                  <span className="mt-1 block truncate text-xs text-[#d5dbea]">
                    {demo.meta}
                  </span>
                </a>
              ))}
            </div>
              </>
            ) : (
              <div className="border-t border-[#2a3140] px-4 py-2">
                <p className="truncate text-xs text-[#b7c0d0]">
                  {selected.name} / {nearbyProjects.length} anchors / {selectedSources.length} sources
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="absolute bottom-4 left-4 z-10 flex max-w-[520px] flex-wrap gap-2">
          <MapLegend color="#ff1f1f" label="Red: selected license package" />
          <MapLegend color="#d98b4a" label="Orange: public project" />
          <MapLegend color="#22d3ee" label="Cyan: ASM / disturbance" />
          <MapLegend color="#4a90e2" label="Blue: cited source" />
        </div>
      </section>

      <aside className="flex h-full w-[390px] shrink-0 flex-col overflow-y-auto bg-[#10141c]">
        <div className="border-b border-[#2a3140] px-4 py-4">
          <div className="grid gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8c96a8]">
                Selected Package
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-[#f4f7fb]">
                {selected.name}
              </p>
            </div>
            <span className="w-fit max-w-full rounded border border-[#4a90e2]/40 bg-[#4a90e2]/10 px-2 py-1 font-mono text-xs leading-5 text-[#9cc6ff]">
              {commodityTape || "Multi"} district
            </span>
          </div>
          <div className="mt-3 rounded-md border border-[#2a3140] bg-[#171c26] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-[#f4f7fb]">
                {isRuntimePackage ? "Live Coordinate Intake" : "Static Result"}
              </span>
              <span className="shrink-0 rounded border border-[#2a3140] px-2 py-1 font-mono text-[11px] text-[#8c96a8]">
                {isRuntimePackage ? "runtime" : "cached"}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-[#8c96a8]">
              Use the two Static Result buttons in the map header for prepared demos;
              use Live Intake below when someone sends a coordinate or license JSON.
            </p>
          </div>
        </div>

        <div className="space-y-3 p-4">
          <section className="workstation-panel border border-[#2a3140] bg-[#171c26]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Upload size={16} className="shrink-0 text-[#22c55e]" />
                <h2 className="truncate text-sm font-semibold">Live Intake</h2>
              </div>
              <span className="shrink-0 font-mono text-xs text-[#8c96a8]">
                point / polygon JSON
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#8c96a8]">
              Paste a coordinate, GeoJSON Point, Polygon, or MultiPolygon. A point becomes a
              small license-style package and reuses the public-source recon workflow.
            </p>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <input
                type="text"
                value={placeQuery}
                onChange={(event) => setPlaceQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyPlaceName();
                  }
                }}
                placeholder={`Place name — try: ${listPlaceNames().join(", ")}`}
                spellCheck={false}
                className="h-9 rounded-md border border-[#2a3140] bg-[#07090d] px-3 text-xs text-[#d5dbea] outline-none transition placeholder:text-[#5a6477] focus:border-[#22c55e]"
              />
              <button
                type="button"
                onClick={applyPlaceName}
                className="h-9 rounded-md border border-[#2a3140] bg-[#10141c] px-3 text-xs font-semibold text-[#b7c0d0] transition hover:border-[#22c55e] hover:text-[#a7f3d0]"
              >
                Use
              </button>
            </div>
            <form action="/" method="get">
              <textarea
                name="intake"
                value={intakeText}
                onChange={(event) => setIntakeText(event.target.value)}
                spellCheck={false}
                className="mt-3 h-28 w-full resize-none rounded-md border border-[#2a3140] bg-[#07090d] px-3 py-2 font-mono text-xs leading-5 text-[#d5dbea] outline-none transition focus:border-[#22c55e]"
              />
              {intakeError ? (
                <div className="mt-2 rounded-md border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-xs text-[#fecaca]">
                  {intakeError}
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-[#2a3140] bg-[#10141c] px-3 py-2 text-xs text-[#b7c0d0] transition hover:border-[#4a90e2]">
                  <Upload size={13} />
                  Upload JSON
                  <input
                    type="file"
                    accept=".json,application/json,geo+json,.geojson"
                    className="hidden"
                    onChange={(event) => void loadIntakeFile(event.target.files?.[0])}
                  />
                </label>
                <button
                  type="submit"
                  onPointerDown={runIntake}
                  onClick={runIntake}
                  className="flex items-center justify-center gap-2 rounded-md bg-[#22c55e] px-3 py-2 text-xs font-semibold text-[#07120a] transition hover:bg-[#86efac]"
                >
                  <Play size={13} />
                  Create package
                </button>
              </div>
            </form>
            {isRuntimePackage ? (
              <div className="mt-3 rounded-md border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-2 text-xs leading-5 text-[#a7f3d0]">
                Runtime package active. Build the evidence package to organize public
                sources for geologist, remote-sensing, and commercial review.
              </div>
            ) : null}
          </section>
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
            {isReconRunning ? "Building Evidence Package" : "Build Evidence Package"}
          </button>
          {reconError ? (
            <div className="rounded-md border border-[#ef4444]/40 bg-[#ef4444]/10 px-3 py-2 text-xs leading-5 text-[#fecaca]">
              {reconError}
            </div>
          ) : null}

          <section className="workstation-panel border border-[#2a3140] bg-[#171c26]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileSearch size={16} className="shrink-0 text-[#22c55e]" />
                <h2 className="truncate text-sm font-semibold">Compare Panel</h2>
              </div>
              <span className="shrink-0 font-mono text-xs text-[#8c96a8]">
                side-by-side
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#8c96a8]">
              Compare two packages by source density, map anchors, and evidence mix before
              opening the underlying citations.
            </p>
            <div className="mt-3 grid gap-2">
              <label className="grid gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.04em] text-[#8c96a8]">
                  Compare against
                </span>
                <select
                  value={compareSelected.id}
                  onChange={(event) => setCompareId(event.target.value)}
                  className="rounded-md border border-[#2a3140] bg-[#07090d] px-3 py-2 text-xs text-[#d5dbea] outline-none transition focus:border-[#22c55e]"
                >
                  {availableConcessions
                    .filter((item) => item.id !== selected.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <CompareStat label="Current" name={selected.name} value={`${evidenceItems.length} sources`} />
                <CompareStat label="Compare" name={compareSelected.name} value={`${compareEvidenceItems.length} sources`} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {compareDelta.metrics.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-md border border-[#2a3140] bg-[#10141c] px-3 py-2"
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[0.04em] text-[#8c96a8]">
                      {metric.label}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#d5dbea]">
                      {metric.left} vs {metric.right}
                    </p>
                  </div>
                ))}
              </div>
              <div className="rounded-md border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.04em] text-[#a7f3d0]">
                  Recon delta
                </p>
                <ul className="mt-1 space-y-1 text-xs leading-5 text-[#d5dbea]">
                  {compareDelta.notes.map((note) => (
                    <li key={note}>- {note}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

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
                label="Red license package"
                text="Selected land package currently being assembled into an evidence file."
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
            <a
              href="https://portals.landfolio.com/CoteDIvoire/en/"
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center justify-between gap-3 rounded-md border border-[#4a90e2]/35 bg-[#4a90e2]/10 px-3 py-2 text-xs text-[#b9dcff] transition hover:border-[#4a90e2]"
            >
              <span className="min-w-0">
                <span className="block font-semibold">Open mining cadastre</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-[#8c96a8]">
                  Live Landfolio portal for title / overlap verification
                </span>
              </span>
              <ExternalLink size={13} className="shrink-0" />
            </a>
            <div className="mt-3 rounded-md border border-[#f5c542]/30 bg-[#f5c542]/10 px-3 py-2 text-xs leading-5 text-[#ffe39b]">
              Same-shear, same-belt, or same-trend references are grouped ahead of
              simple distance reads.
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
                <button
                  key={layer.label}
                  onClick={() => activateCoverageLayer(layer.label)}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-[#2a3140] bg-[#10141c] px-3 py-2 text-left transition hover:border-[#4a90e2] hover:bg-[#121824]"
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
                </button>
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
                  No sources in this role for the selected package.
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
              Orange pins are company anchors; cyan pins are ASM / remote-sensing disturbance anchors; green pins are institutional sources. Treat distance as context;
              inspect same-shear, same-belt, or same-trend references first.
            </p>
            <div className="mt-3 space-y-2">
              {nearbyProjects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setFocusedProjectId(project.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left transition hover:border-[#4a90e2] hover:bg-[#121824] ${
                    focusedProjectId === project.id
                      ? "border-[#f5c542]/70 bg-[#f5c542]/10"
                      : "border-[#2a3140] bg-[#10141c]"
                  }`}
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
                </button>
              ))}
            </div>
          </section>

          <section className="workstation-panel border border-[#2a3140] bg-[#171c26]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Activity size={16} className="shrink-0 text-[#4a90e2]" />
                <h2 className="truncate text-sm font-semibold">Evidence Package</h2>
              </div>
              <span className="shrink-0 font-mono text-xs text-[#8c96a8]">
                {visibleEvidenceItems.length}/{evidenceItems.length} citations
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-[#8c96a8]">
              Source-backed citations grouped by geology, remote sensing, license, and
              commercial context for follow-up research.
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
                  <h2 className="truncate text-sm font-semibold">Recon Brief</h2>
                </div>
                <p className="mt-1 text-xs text-[#8c96a8]">
                  A citation-led brief for researchers and technical reviewers.
                </p>
              </div>
              <div className={`shrink-0 rounded-md border px-3 py-2 text-center ${packageStatusTone}`}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.04em]">
                  Package Status
                </p>
                <p className="text-base font-bold">{packageStatus}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <BriefMetric label="Output" value="Evidence" />
              <BriefMetric label="Sources" value={evidenceItems.length.toString()} />
              <BriefMetric label="Anchors" value={nearbyProjects.length.toString()} />
            </div>
            {reconBrief ? (
              <div className="mt-4 rounded-md border border-[#2a3140] bg-[#10141c] px-3 py-3">
                <div className="whitespace-pre-wrap text-xs leading-5 text-[#d5dbea]">
                  {reconBrief}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-2 text-sm leading-6 text-[#d5dbea]">
                <MemoRow
                  label="Research Collaboration Model"
                  text="The app packages public data for geology, remote-sensing, and commercial reviewers; it does not replace source review."
                />
                <MemoRow
                  label="Geology / Geochemistry / Geophysics"
                  text="Use regional geology, soil or stream geochemistry, geophysics, and public drilling/resource analogues to frame field-verification questions."
                />
                <MemoRow
                  label="Remote Sensing / ASM Read"
                  text="Cached layers flag disturbance and possible workings as prompts for verification, not standalone proof of mineralization."
                />
                <MemoRow
                  label="Missing Data"
                  text="Confirm tenure status, local geology, structure, access, and whether disclosed mineralized trends are relevant to the package."
                />
                <MemoRow
                  label="Evidence Build Plan"
                  text="Geology checks structure and sampling logic; remote sensing screens disturbance and access; commercial review builds counterparties and source library."
                />
              </div>
            )}
            <div className="mt-4 rounded-md border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-3 py-2">
              <div className="flex gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#f5c542]" />
                <p className="text-xs leading-5 text-[#ffd48a]">
                  This tool does not verify mineralization or economics. It packages
                  public evidence so reviewers can plan source checks and field follow-up.
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

function upsertConcession(items: Concession[], concession: Concession) {
  const existingIndex = items.findIndex((item) => item.id === concession.id);
  if (existingIndex === -1) return [...items, concession];

  const next = [...items];
  next[existingIndex] = concession;
  return next;
}

function parseIntakeConcession(raw: string): Concession {
  const parsed = JSON.parse(raw) as unknown;
  const geometry = extractGeometry(parsed);
  const name = extractName(parsed) ?? "Live intake package";
  const id = `runtime-${slugify(name)}`;

  if (geometry.type === "Point") {
    return buildPointConcession(id, name, geometry.coordinates as [number, number]);
  }

  if (geometry.type === "Polygon" || geometry.type === "MultiPolygon") {
    return {
      id,
      name,
      country: "CI",
      center: getGeometryCenter(geometry),
      polygon: geometry,
    };
  }

  throw new Error("Use a Point, Polygon, MultiPolygon, or { lat, lng } JSON object.");
}

function safeParseIntakeConcession(raw?: string) {
  if (!raw) return undefined;
  try {
    return parseIntakeConcession(raw);
  } catch {
    return undefined;
  }
}

function extractGeometry(input: unknown): GeoJSON.Geometry {
  if (!isRecord(input)) {
    throw new Error("Input must be a JSON object.");
  }

  if (input.type === "Feature" && isRecord(input.geometry)) {
    return input.geometry as unknown as GeoJSON.Geometry;
  }

  if (
    (input.type === "Point" || input.type === "Polygon" || input.type === "MultiPolygon") &&
    Array.isArray(input.coordinates)
  ) {
    return input as unknown as GeoJSON.Geometry;
  }

  const lng = numberField(input, ["lng", "lon", "longitude"]);
  const lat = numberField(input, ["lat", "latitude"]);
  if (lng !== undefined && lat !== undefined) {
    return { type: "Point", coordinates: [lng, lat] };
  }

  if (Array.isArray(input.point) && input.point.length >= 2) {
    const [first, second] = input.point;
    if (typeof first === "number" && typeof second === "number") {
      return { type: "Point", coordinates: [first, second] };
    }
  }

  throw new Error("Expected { lat, lng }, GeoJSON Point, Polygon, or MultiPolygon.");
}

function extractName(input: unknown) {
  if (!isRecord(input)) return undefined;
  if (typeof input.name === "string" && input.name.trim()) return input.name.trim();
  if (isRecord(input.properties) && typeof input.properties.name === "string") {
    return input.properties.name.trim();
  }
  return undefined;
}

function buildPointConcession(
  id: string,
  name: string,
  [lng, lat]: [number, number],
): Concession {
  return {
    id,
    name,
    country: "CI",
    center: [lng, lat],
    polygon: {
      type: "MultiPolygon",
      coordinates: [
        rectangle(lng - 0.09, lat - 0.06, lng + 0.05, lat + 0.04),
        rectangle(lng + 0.08, lat - 0.02, lng + 0.18, lat + 0.07),
        rectangle(lng - 0.03, lat + 0.10, lng + 0.06, lat + 0.17),
      ],
    },
  };
}

function rectangle(west: number, south: number, east: number, north: number) {
  return [[[west, south], [east, south], [east, north], [west, north], [west, south]]];
}

function getGeometryCenter(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number] {
  const points = flattenCoordinates(geometry.coordinates);
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ];
}

function flattenCoordinates(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  ) {
    return [[value[0], value[1]]];
  }
  return value.flatMap((item) => flattenCoordinates(item));
}

function numberField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (typeof record[key] === "number") return record[key];
    if (typeof record[key] === "string" && record[key].trim()) {
      const value = Number(record[key]);
      if (Number.isFinite(value)) return value;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "package";
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

function BriefMetric({ label, value }: { label: string; value: string }) {
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

function CompareStat({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-md border border-[#2a3140] bg-[#10141c] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.04em] text-[#8c96a8]">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-[#f4f7fb]">{name}</p>
      <p className="mt-1 font-mono text-[11px] text-[#9cc6ff]">{value}</p>
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

function buildCompareDelta({
  left,
  right,
  leftProjects,
  rightProjects,
  leftEvidence,
  rightEvidence,
  leftMix,
  rightMix,
}: {
  left: Concession;
  right: Concession;
  leftProjects: PublicCompanyProject[];
  rightProjects: PublicCompanyProject[];
  leftEvidence: EvidenceItem[];
  rightEvidence: EvidenceItem[];
  leftMix: ReturnType<typeof buildSourceMix>;
  rightMix: ReturnType<typeof buildSourceMix>;
}) {
  const leftTechnical = countEvidenceTypes(leftEvidence, [
    "drilling_result",
    "resource_estimate",
    "geochemistry",
    "geophysics",
    "research_paper",
  ]);
  const rightTechnical = countEvidenceTypes(rightEvidence, [
    "drilling_result",
    "resource_estimate",
    "geochemistry",
    "geophysics",
    "research_paper",
  ]);
  const leftRemote = countEvidenceTypes(leftEvidence, ["remote_sensing", "asm_activity", "trenching"]);
  const rightRemote = countEvidenceTypes(rightEvidence, ["remote_sensing", "asm_activity", "trenching"]);
  const leftLicense = countEvidenceTypes(leftEvidence, ["license_activity", "cadastre"]);
  const rightLicense = countEvidenceTypes(rightEvidence, ["license_activity", "cadastre"]);

  const notes = [
    `${left.name} has ${leftEvidence.length - rightEvidence.length >= 0 ? "at least as much" : "less"} cached public-source density than ${right.name}.`,
    `${leftTechnical} vs ${rightTechnical} technical/geology items: geologist should inspect same-trend relevance before drawing conclusions.`,
    `${leftRemote} vs ${rightRemote} remote/ASM items: remote-sensing team gets a quick queue of disturbance and workings references.`,
    `${leftLicense} vs ${rightLicense} license/cadastre items: commercial team should still verify status in Landfolio or official records.`,
  ];

  return {
    metrics: [
      {
        label: "Map anchors",
        left: leftProjects.length.toString(),
        right: rightProjects.length.toString(),
      },
      {
        label: "Public co.",
        left: leftMix.publicCompany.toString(),
        right: rightMix.publicCompany.toString(),
      },
      {
        label: "Papers",
        left: leftMix.publicPaper.toString(),
        right: rightMix.publicPaper.toString(),
      },
      {
        label: "Gov / inst.",
        left: leftMix.institutional.toString(),
        right: rightMix.institutional.toString(),
      },
    ],
    notes,
  };
}

function countEvidenceTypes(items: EvidenceItem[], types: EvidenceItem["evidenceType"][]) {
  return items.filter((item) => types.includes(item.evidenceType)).length;
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

async function streamReconBrief(
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
  const briefStatus: TimelineStatus =
    step === "brief"
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
      label: "Structuring package evidence",
      meta: step === "idle" ? `${sourceCount} sources` : `${evidenceCount} evidence items`,
      status: extractionStatus,
    },
    {
      label: "Drafting recon brief",
      meta: "GPT-5.5",
      status: briefStatus,
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
