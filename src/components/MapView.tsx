"use client";

import { useMemo, useState } from "react";
import type { Concession, PublicCompanyProject, SourcePack } from "@/lib/types";

type ProjectWithDistance = PublicCompanyProject & { distanceKm: number };

type MapViewProps = {
  concessions: Concession[];
  selected: Concession;
  projects: ProjectWithDistance[];
  sources: SourcePack[];
  focusProjectId?: string;
  onSelect: (id: string) => void;
};

type MapMode = "satellite" | "geology" | "admin";
type MapCard =
  | {
      kind: "project";
      title: string;
      subtitle: string;
      meta: string;
      href?: string;
    }
  | {
      kind: "evidence";
      title: string;
      subtitle: string;
      meta: string;
      href: string;
    };

const mapBounds = {
  west: -8.55,
  east: -1.86,
  north: 10.65,
  south: 3.78,
};

const cities = [
  { name: "Abidjan", role: "Commercial hub", lng: -4.03, lat: 5.35 },
  { name: "Yamoussoukro", role: "Capital / central access", lng: -5.28, lat: 6.82 },
  { name: "Bouaké", role: "Northern corridor", lng: -5.03, lat: 7.69 },
  { name: "Man", role: "Western access", lng: -7.55, lat: 7.41 },
];

export default function MapView({
  concessions,
  selected,
  projects,
  sources,
  focusProjectId,
  onSelect,
}: MapViewProps) {
  const [mapMode, setMapMode] = useState<MapMode>("satellite");
  const [controlsOpen, setControlsOpen] = useState(true);
  const [mapCard, setMapCard] = useState<MapCard | null>(null);
  const [opacity, setOpacity] = useState({
    satellite: 0.86,
    geology: 0.58,
    admin: 0.68,
  });
  const evidencePins = useMemo(
    () => buildEvidencePins(projects, sources),
    [projects, sources],
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#07090d]">
      <RasterLayer
        src="/overlays/civ-satellite-map.jpg"
        opacity={opacity.satellite}
        filter="saturate(0.95) contrast(1.04) brightness(0.92)"
      />
      <RasterLayer
        src="/overlays/civ-geology-sems-map.jpg"
        opacity={mapMode === "geology" ? opacity.geology : 0}
        filter="saturate(1.02) contrast(1.06) brightness(0.82)"
      />
      <RasterLayer
        src="/overlays/civ-admin-map.jpg"
        opacity={mapMode === "admin" ? opacity.admin : 0}
        filter="saturate(0.72) contrast(1.05) brightness(0.86)"
      />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px] opacity-25" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,9,13,0.02),rgba(7,9,13,0.16))]" />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <rect
          x="8"
          y="4"
          width="78"
          height="90"
          rx="1.5"
          fill="rgba(17,24,39,0.04)"
          stroke="#d9e7ff"
          strokeWidth="0.28"
          strokeDasharray="1.4 0.8"
          vectorEffect="non-scaling-stroke"
        />
        {concessions.map((concession) => (
          <g
            key={concession.id}
            onClick={() => onSelect(concession.id)}
            className="cursor-pointer"
          >
            {polygonRings(concession.polygon).map((ring, index) => {
              const isSelected = concession.id === selected.id;
              return (
                <polygon
                  key={`${concession.id}-${index}`}
                  points={ring.map(([lng, lat]) => projectPoint(lng, lat).join(",")).join(" ")}
                  fill={isSelected ? "rgba(255,31,31,0.13)" : "rgba(255,123,74,0.08)"}
                  stroke={isSelected ? "#ff1f1f" : "#ff7b4a"}
                  strokeWidth={isSelected ? 0.46 : 0.26}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        ))}
      </svg>

      {cities.map((city) => {
        const [left, top] = projectPoint(city.lng, city.lat);
        return (
          <MapPin
            key={city.name}
            left={left}
            top={top}
            color="#9fe3c4"
            label={city.name}
            title={`${city.name}: ${city.role}`}
          />
        );
      })}

      {projects.map((project) => {
        const [left, top] = projectPoint(project.lng, project.lat);
        const kind = getProjectPinKind(project);
        const focused = focusProjectId === project.id;
        return (
          <button
            key={project.id}
            type="button"
            onClick={() =>
              setMapCard({
                kind: "project",
                title: project.project,
                subtitle: project.company,
                meta: `${getProjectPinLabel(project)} / ${project.distanceKm}km from selected package`,
                href: project.sourceUrls[0],
              })
            }
            title={`${project.project} / ${project.company} / ${project.distanceKm}km`}
            className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#07090d] shadow-lg transition ${
              focused ? "h-5 w-5 ring-4 ring-[#f5c542]/45" : "h-3.5 w-3.5 hover:h-4 hover:w-4"
            }`}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              backgroundColor: pinColor(kind),
            }}
          />
        );
      })}

      {evidencePins.map((pin) => {
        const [left, top] = projectPoint(pin.lng, pin.lat);
        return (
          <MapPin
            key={pin.id}
            left={left}
            top={top}
            color="#4a90e2"
            label=""
            title={`${pin.title} / ${pin.project}`}
            onClick={() =>
              setMapCard({
                kind: "evidence",
                title: pin.title,
                subtitle: pin.project,
                meta: pin.sourceType,
                href: pin.sourceUrl,
              })
            }
            small
          />
        );
      })}

      {mapCard ? <MapInfoCard card={mapCard} onClose={() => setMapCard(null)} /> : null}

      <div className="absolute right-4 top-[330px] z-20 grid w-[220px] gap-2 rounded-md border border-[#2a3140] bg-[#10141c]/88 px-2.5 py-2 text-[10px] text-[#d7deea] shadow-2xl backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#9aa6b8]">
            Layers
          </span>
          <button
            type="button"
            onClick={() => setControlsOpen((open) => !open)}
            className="h-6 rounded border border-[#2a3140] bg-[#07090d]/75 px-2 font-mono text-[9px] uppercase tracking-[0.04em] text-[#9aa6b8] transition hover:border-[#4a90e2] hover:text-[#d7deea]"
          >
            {controlsOpen ? "Hide" : "Show"}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-md border border-[#2a3140] bg-[#07090d]/65 p-1">
          {(["satellite", "geology", "admin"] as MapMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onPointerDown={() => setMapMode(mode)}
              onClick={() => setMapMode(mode)}
              className={`h-7 rounded px-1 font-mono text-[9px] uppercase tracking-[0.02em] transition ${
                mapMode === mode
                  ? "bg-[#f5c542]/20 text-[#ffe39b] ring-1 ring-[#f5c542]"
                  : "text-[#8c96a8] hover:bg-[#171c26] hover:text-[#d7deea]"
              }`}
            >
              {mode === "satellite" ? "Sat" : mode === "geology" ? "Geo" : "Admin"}
            </button>
          ))}
        </div>
        {controlsOpen ? (
          <>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              <MapLegendItem color="#ff1f1f" label="Package" variant="line" />
              <MapLegendItem color="#d98b4a" label="Project" />
              <MapLegendItem color="#22d3ee" label="ASM" />
              <MapLegendItem color="#4a90e2" label="Source" />
              <MapLegendItem color="#d9e7ff" label="Boundary" variant="line" muted />
              <MapLegendItem color="#9fe3c4" label="City" muted />
            </div>
            <p className="truncate border-t border-[#2a3140] pt-1.5 text-[9px] leading-4 text-[#ffd48a]">
              Satellite base + optional overlays
            </p>
            <div className="grid gap-1.5 border-t border-[#2a3140] pt-1.5">
              <OpacitySlider
                active={mapMode === "satellite"}
                label="Sat"
                value={opacity.satellite}
                onChange={(value) => setOpacity((current) => ({ ...current, satellite: value }))}
              />
              <OpacitySlider
                active={mapMode === "geology"}
                label="Geo"
                value={opacity.geology}
                onChange={(value) => setOpacity((current) => ({ ...current, geology: value }))}
              />
              <OpacitySlider
                active={mapMode === "admin"}
                label="Admin"
                value={opacity.admin}
                onChange={(value) => setOpacity((current) => ({ ...current, admin: value }))}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function RasterLayer({
  src,
  opacity,
  filter,
}: {
  src: string;
  opacity: number;
  filter: string;
}) {
  return (
    <img
      src={src}
      alt=""
      className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300"
      style={{
        filter,
        opacity,
      }}
      draggable={false}
    />
  );
}

function MapPin({
  left,
  top,
  color,
  label,
  title,
  onClick,
  small = false,
}: {
  left: number;
  top: number;
  color: string;
  label: string;
  title: string;
  onClick?: () => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 text-left"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <span
        className={`rounded-full border border-[#07090d] shadow-lg ${
          small ? "h-2.5 w-2.5" : "h-3.5 w-3.5"
        }`}
        style={{ backgroundColor: color }}
      />
      {label ? (
        <span className="rounded bg-[#07090d]/70 px-1.5 py-0.5 text-[10px] font-semibold text-[#eef6ff] shadow">
          {label}
        </span>
      ) : null}
    </button>
  );
}

function MapInfoCard({
  card,
  onClose,
}: {
  card: MapCard;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-24 left-4 z-30 max-w-[360px] rounded border border-[#2a3140] bg-[#10141c]/95 p-3 text-xs text-[#d5dbea] shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.04em] text-[#8c96a8]">
            {card.kind === "project" ? "Public map anchor" : "Evidence source"}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#f4f7fb]">{card.title}</p>
          <p className="mt-1 text-[11px] leading-4 text-[#8c96a8]">{card.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-[#2a3140] px-2 py-1 font-mono text-[10px] text-[#8c96a8] hover:border-[#4a90e2] hover:text-[#d7deea]"
        >
          Close
        </button>
      </div>
      <p className="mt-2 leading-5 text-[#d5dbea]">{card.meta}</p>
      {card.href ? (
        <a
          href={card.href}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex rounded border border-[#4a90e2]/40 bg-[#4a90e2]/10 px-2 py-1 font-semibold text-[#b9dcff] hover:border-[#4a90e2]"
        >
          Open source
        </a>
      ) : null}
    </div>
  );
}

function OpacitySlider({
  active,
  label,
  value,
  onChange,
}: {
  active: boolean;
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label
      className={`grid grid-cols-[44px_1fr_28px] items-center gap-1.5 font-mono text-[9px] transition ${
        active ? "text-[#d7deea]" : "text-[#6f7a8c]"
      }`}
    >
      <span>{label}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={`h-1 min-w-0 accent-[#f5c542] ${active ? "" : "opacity-65"}`}
      />
      <span className={active ? "text-right text-[#d7deea]" : "text-right text-[#7c8798]"}>
        {Math.round(value * 100)}%
      </span>
    </label>
  );
}

function MapLegendItem({
  color,
  label,
  muted = false,
  variant = "dot",
}: {
  color: string;
  label: string;
  muted?: boolean;
  variant?: "dot" | "line";
}) {
  return (
    <div className={`flex min-w-0 items-center gap-1.5 ${muted ? "opacity-55" : ""}`}>
      <span
        className={
          variant === "line"
            ? "h-0 w-4 shrink-0 border-t-2 border-dashed"
            : "h-2 w-2 shrink-0 rounded-full border border-[#07090d]"
        }
        style={variant === "line" ? { borderColor: color } : { backgroundColor: color }}
      />
      <span className="truncate font-mono text-[9px]">{label}</span>
    </div>
  );
}

function projectPoint(lng: number, lat: number): [number, number] {
  const x = ((lng - mapBounds.west) / (mapBounds.east - mapBounds.west)) * 100;
  const y = ((mapBounds.north - lat) / (mapBounds.north - mapBounds.south)) * 100;
  return [clamp(x), clamp(y)];
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function polygonRings(polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon) {
  if (polygon.type === "Polygon") return polygon.coordinates.map((ring) => ring as [number, number][]);
  return polygon.coordinates.flatMap((shape) =>
    shape.map((ring) => ring as [number, number][]),
  );
}

function buildEvidencePins(projects: ProjectWithDistance[], sources: SourcePack[]) {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return sources.flatMap((source, index) => {
    const project = projectById.get(source.projectId);
    if (!project) return [];
    return [
      {
        id: source.id,
        title: source.sourceTitle,
        project: source.project,
        sourceUrl: source.sourceUrl,
        sourceType: source.sourceType.replaceAll("_", " "),
        lng: project.lng + (index % 2 === 0 ? 0.08 : -0.08),
        lat: project.lat + (index % 2 === 0 ? 0.06 : -0.06),
      },
    ];
  });
}

function getProjectPinKind(project: PublicCompanyProject) {
  const text =
    `${project.company} ${project.project} ${project.exchange} ${project.commodities.join(" ")}`.toLowerCase();

  if (/asm|artisanal|remote sensing|landsat|bandama|kokumbo/.test(text)) {
    return "asm";
  }

  if (/sodemi|cadastre|ministry|government|geological survey/.test(text)) {
    return "institutional";
  }

  return "project";
}

function getProjectPinLabel(project: PublicCompanyProject) {
  switch (getProjectPinKind(project)) {
    case "asm":
      return "ASM / remote-sensing disturbance anchor";
    case "institutional":
      return "Government / geoscience source anchor";
    default:
      return "Public-company comparator";
  }
}

function pinColor(kind: string) {
  if (kind === "asm") return "#22d3ee";
  if (kind === "institutional") return "#9fe3c4";
  return "#d98b4a";
}
