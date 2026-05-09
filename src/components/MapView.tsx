"use client";

import { useEffect, useRef } from "react";
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import * as turf from "@turf/turf";
import ciMapContext from "@/data/cote_divoire_map_context.json";
import type { Concession, PublicCompanyProject, SourcePack } from "@/lib/types";

type ProjectWithDistance = PublicCompanyProject & { distanceKm: number };
type MapContextProperties = {
  id: string;
  kind: "country_boundary" | "city";
  name: string;
  label?: string;
  role?: string;
};

type MapViewProps = {
  concessions: Concession[];
  selected: Concession;
  projects: ProjectWithDistance[];
  sources: SourcePack[];
  onSelect: (id: string) => void;
};

const style = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
      paint: {
        "raster-saturation": -0.25,
        "raster-contrast": 0.12,
        "raster-brightness-min": 0.08,
        "raster-brightness-max": 0.72,
      },
    },
  ],
} as maplibregl.StyleSpecification;

const mapContext =
  ciMapContext as GeoJSON.FeatureCollection<GeoJSON.Geometry, MapContextProperties>;

export default function MapView({
  concessions,
  selected,
  projects,
  sources,
  onSelect,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const initialDataRef = useRef({ concessions, projects, selected, sources });

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialData = initialDataRef.current;

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style,
      center: [-5.5, 7.5],
      zoom: 6,
      attributionControl: false,
    });

    mapRef.current.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-left",
    );

    mapRef.current.on("load", () => {
      const map = mapRef.current;
      if (!map) return;

      map.addSource("concessions", {
        type: "geojson",
        data: buildConcessionCollection(
          initialData.concessions,
          initialData.selected.id,
        ),
      });
      map.addSource("radius", {
        type: "geojson",
        data: buildRadius(initialData.selected),
      });
      map.addSource("projects", {
        type: "geojson",
        data: buildProjectCollection(initialData.projects),
      });
      map.addSource("evidence", {
        type: "geojson",
        data: buildEvidenceCollection(initialData.projects, initialData.sources),
      });
      map.addSource("map-context", {
        type: "geojson",
        data: mapContext,
      });

      map.addLayer({
        id: "country-boundary-fill",
        type: "fill",
        source: "map-context",
        filter: ["==", ["get", "kind"], "country_boundary"],
        paint: {
          "fill-color": "#111827",
          "fill-opacity": 0.08,
        },
      });
      map.addLayer({
        id: "country-boundary-line",
        type: "line",
        source: "map-context",
        filter: ["==", ["get", "kind"], "country_boundary"],
        paint: {
          "line-color": "#d9e7ff",
          "line-width": 2,
          "line-opacity": 0.8,
          "line-dasharray": [3, 1.5],
        },
      });
      map.addLayer({
        id: "radius-fill",
        type: "fill",
        source: "radius",
        paint: {
          "fill-color": "#4a90e2",
          "fill-opacity": 0.04,
        },
      });
      map.addLayer({
        id: "radius-line",
        type: "line",
        source: "radius",
        paint: {
          "line-color": "#4a90e2",
          "line-width": 1,
          "line-opacity": 0.55,
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: "concession-halo",
        type: "line",
        source: "concessions",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "selected"], true],
            "#ff1f1f",
            "#ff7b4a",
          ],
          "line-opacity": [
            "case",
            ["==", ["get", "selected"], true],
            0.45,
            0.18,
          ],
          "line-width": [
            "case",
            ["==", ["get", "selected"], true],
            7,
            4,
          ],
          "line-blur": 2,
        },
      });
      map.addLayer({
        id: "concession-fill",
        type: "fill",
        source: "concessions",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "selected"], true],
            "#ff1f1f",
            "#ff7b4a",
          ],
          "fill-opacity": [
            "case",
            ["==", ["get", "selected"], true],
            0.02,
            0.03,
          ],
        },
      });
      map.addLayer({
        id: "concession-line",
        type: "line",
        source: "concessions",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "selected"], true],
            "#ff1f1f",
            "#ff7b4a",
          ],
          "line-width": [
            "case",
            ["==", ["get", "selected"], true],
            3,
            1.5,
          ],
          "line-opacity": 0.98,
        },
      });
      map.addLayer({
        id: "project-rings",
        type: "circle",
        source: "projects",
        paint: {
          "circle-color": projectPointColorExpression(),
          "circle-radius": 13,
          "circle-opacity": 0.12,
          "circle-stroke-color": projectPointColorExpression(),
          "circle-stroke-opacity": 0.35,
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "project-pins",
        type: "circle",
        source: "projects",
        paint: {
          "circle-color": projectPointColorExpression(),
          "circle-radius": 7,
          "circle-stroke-color": "#07090d",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "evidence-pins",
        type: "circle",
        source: "evidence",
        paint: {
          "circle-color": "#4a90e2",
          "circle-radius": 4.5,
          "circle-stroke-color": "#f4f7fb",
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "city-halos",
        type: "circle",
        source: "map-context",
        filter: ["==", ["get", "kind"], "city"],
        paint: {
          "circle-color": "#9fe3c4",
          "circle-radius": 8,
          "circle-opacity": 0.12,
          "circle-stroke-color": "#9fe3c4",
          "circle-stroke-opacity": 0.38,
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "city-pins",
        type: "circle",
        source: "map-context",
        filter: ["==", ["get", "kind"], "city"],
        paint: {
          "circle-color": "#9fe3c4",
          "circle-radius": 4.5,
          "circle-stroke-color": "#07090d",
          "circle-stroke-width": 1.5,
        },
      });
      addContextLabels(map);

      const hoverPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
      });
      const bindHover = (
        layerId: string,
        getHtml: (feature: maplibregl.MapGeoJSONFeature) => string,
      ) => {
        map.on("mouseenter", layerId, (event) => {
          const feature = event.features?.[0];
          if (!feature) return;
          map.getCanvas().style.cursor = "pointer";
          hoverPopup.setLngLat(event.lngLat).setHTML(getHtml(feature)).addTo(map);
        });
        map.on("mousemove", layerId, (event) => {
          if (hoverPopup.isOpen()) hoverPopup.setLngLat(event.lngLat);
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
          hoverPopup.remove();
        });
      };

      map.on("click", "concession-fill", (event) => {
        const feature = event.features?.[0];
        const id = feature?.properties?.id;
        if (typeof id === "string") onSelectRef.current(id);
        new maplibregl.Popup()
          .setLngLat(event.lngLat)
          .setHTML(
            buildPopupHtml("AOI", feature?.properties?.name, [
              "Selected concession search area",
              "Red polygon and blue dashed radius",
            ]),
          )
          .addTo(map);
      });

      map.on("click", "project-pins", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        new maplibregl.Popup()
          .setLngLat(event.lngLat)
          .setHTML(
            buildPopupHtml("Public project", feature.properties?.project, [
              feature.properties?.company,
              feature.properties?.pinLabel,
              `${feature.properties?.distanceKm}km from selected AOI`,
            ]),
          )
          .addTo(map);
      });

      map.on("click", "evidence-pins", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        new maplibregl.Popup()
          .setLngLat(event.lngLat)
          .setHTML(
            buildPopupHtml("Evidence source", feature.properties?.title, [
              feature.properties?.project,
              feature.properties?.sourceType,
            ]),
          )
          .addTo(map);
      });

      map.on("click", "city-pins", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        new maplibregl.Popup()
          .setLngLat(event.lngLat)
          .setHTML(
            buildPopupHtml("City", feature.properties?.name, [
              feature.properties?.role,
            ]),
          )
          .addTo(map);
      });

      map.on("click", "country-boundary-line", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        new maplibregl.Popup()
          .setLngLat(event.lngLat)
          .setHTML(
            buildPopupHtml("Country boundary", feature.properties?.name, [
              "Simplified Côte d'Ivoire national outline",
            ]),
          )
          .addTo(map);
      });

      bindHover("concession-fill", (feature) =>
        buildPopupHtml("AOI", feature.properties?.name, [
          "Selected concession search area",
        ]),
      );
      bindHover("project-pins", (feature) =>
        buildPopupHtml("Public project", feature.properties?.project, [
          feature.properties?.company,
        ]),
      );
      bindHover("evidence-pins", (feature) =>
        buildPopupHtml("Evidence source", feature.properties?.title, [
          feature.properties?.project,
        ]),
      );
      bindHover("city-pins", (feature) =>
        buildPopupHtml("City", feature.properties?.name, [feature.properties?.role]),
      );
      bindHover("country-boundary-line", (feature) =>
        buildPopupHtml("Country boundary", feature.properties?.name, [
          "Simplified national outline",
        ]),
      );
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;

    updateSource(map, "concessions", buildConcessionCollection(concessions, selected.id));
    updateSource(map, "radius", buildRadius(selected));
    updateSource(map, "projects", buildProjectCollection(projects));
    updateSource(map, "evidence", buildEvidenceCollection(projects, sources));

    const bounds = turf.bbox(selected.polygon) as [number, number, number, number];
    map.fitBounds(bounds, {
      padding: { top: 150, bottom: 95, left: 95, right: 95 },
      duration: 900,
    });
  }, [concessions, projects, selected, sources]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="pointer-events-none absolute right-4 top-4 grid gap-2 rounded border border-[#2a3140] bg-[#10141c]/90 px-3 py-2 text-[11px] text-[#d7deea] shadow-2xl backdrop-blur">
        <MapLegendItem color="#d9e7ff" label="Country boundary" variant="line" />
        <MapLegendItem color="#ff1f1f" label="Selected AOI" variant="line" />
        <MapLegendItem color="#d98b4a" label="Public project" />
        <MapLegendItem color="#22d3ee" label="ASM / disturbance" />
        <MapLegendItem color="#4a90e2" label="Evidence source" />
        <MapLegendItem color="#9fe3c4" label="City" />
      </div>
    </div>
  );
}

function projectPointColorExpression() {
  return [
    "case",
    ["==", ["get", "pinKind"], "asm"],
    "#22d3ee",
    ["==", ["get", "pinKind"], "institutional"],
    "#9fe3c4",
    "#d98b4a",
  ] as maplibregl.ExpressionSpecification;
}

function MapLegendItem({
  color,
  label,
  variant = "dot",
}: {
  color: string;
  label: string;
  variant?: "dot" | "line";
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          variant === "line"
            ? "h-0 w-5 border-t-2 border-dashed"
            : "h-2.5 w-2.5 rounded-full border border-[#07090d]"
        }
        style={
          variant === "line"
            ? { borderColor: color }
            : { backgroundColor: color }
        }
      />
      <span className="font-mono">{label}</span>
    </div>
  );
}

function addContextLabels(map: MapLibreMap) {
  const cityFeatures = mapContext.features.filter(
    (
      feature,
    ): feature is GeoJSON.Feature<GeoJSON.Point, MapContextProperties> =>
      feature.properties.kind === "city" && feature.geometry.type === "Point",
  );

  cityFeatures.forEach((feature) => {
    new maplibregl.Marker({
      element: createMapLabel(feature.properties.name, "city"),
      offset: [0, 15],
    })
      .setLngLat(feature.geometry.coordinates as [number, number])
      .addTo(map);
  });

  new maplibregl.Marker({
    element: createMapLabel("Country boundary", "boundary"),
    offset: [0, -12],
  })
    .setLngLat([-6.75, 10.45])
    .addTo(map);
}

function createMapLabel(label: string, variant: "boundary" | "city") {
  const element = document.createElement("div");
  element.textContent = label;
  element.style.pointerEvents = "none";
  element.style.whiteSpace = "nowrap";
  element.style.fontFamily =
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  element.style.fontSize = variant === "boundary" ? "12px" : "11px";
  element.style.fontWeight = variant === "boundary" ? "700" : "600";
  element.style.color = variant === "boundary" ? "#d9e7ff" : "#dff8ec";
  element.style.textShadow =
    "0 1px 2px #07090d, 0 -1px 2px #07090d, 1px 0 2px #07090d, -1px 0 2px #07090d";
  element.style.background =
    variant === "boundary" ? "rgba(7, 9, 13, 0.68)" : "rgba(7, 9, 13, 0.48)";
  element.style.border =
    variant === "boundary" ? "1px dashed rgba(217, 231, 255, 0.7)" : "0";
  element.style.borderRadius = "4px";
  element.style.padding = variant === "boundary" ? "3px 6px" : "1px 4px";
  return element;
}

function updateSource(map: MapLibreMap, id: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  source?.setData(data);
}

function buildPopupHtml(kind: string, title: unknown, details: unknown[] = []) {
  const safeDetails = details
    .filter((detail): detail is string | number => {
      return typeof detail === "string" || typeof detail === "number";
    })
    .map((detail) => `<em>${escapeHtml(String(detail))}</em>`)
    .join("");

  return `<div class="recon-popup"><span>${escapeHtml(kind)}</span><strong>${escapeHtml(
    String(title ?? "Map feature"),
  )}</strong>${safeDetails}</div>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

function buildConcessionCollection(concessions: Concession[], selectedId: string) {
  return {
    type: "FeatureCollection",
    features: concessions.map((concession) => ({
      type: "Feature",
      properties: {
        id: concession.id,
        name: concession.name,
        selected: concession.id === selectedId,
      },
      geometry: concession.polygon,
    })),
  } satisfies GeoJSON.FeatureCollection;
}

function buildRadius(concession: Concession) {
  const center = turf.centroid(concession.polygon);
  return turf.featureCollection([
    turf.circle(center, 150, {
      steps: 96,
      units: "kilometers",
      properties: { id: `${concession.id}-radius` },
    }),
  ]);
}

function buildProjectCollection(projects: ProjectWithDistance[]) {
  return {
    type: "FeatureCollection",
    features: projects.map((project) => ({
      type: "Feature",
      properties: {
        id: project.id,
        company: project.company,
        project: project.project,
        ticker: project.ticker,
        distanceKm: project.distanceKm,
        pinKind: getProjectPinKind(project),
        pinLabel: getProjectPinLabel(project),
      },
      geometry: {
        type: "Point",
        coordinates: [project.lng, project.lat],
      },
    })),
  } satisfies GeoJSON.FeatureCollection;
}

function getProjectPinKind(project: PublicCompanyProject) {
  const text = `${project.company} ${project.project} ${project.exchange} ${project.commodities.join(" ")}`.toLowerCase();

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

function buildEvidenceCollection(
  projects: ProjectWithDistance[],
  sources: SourcePack[],
) {
  const projectById = new Map(projects.map((project) => [project.id, project]));

  return {
    type: "FeatureCollection",
    features: sources.flatMap((source, index) => {
      const project = projectById.get(source.projectId);
      if (!project) return [];
      return [
        {
          type: "Feature",
          properties: {
            id: source.id,
            title: source.sourceTitle,
            project: source.project,
            company: source.company,
            sourceType: source.sourceType.replaceAll("_", " "),
          },
          geometry: {
            type: "Point",
            coordinates: [
              project.lng + (index % 2 === 0 ? 0.08 : -0.08),
              project.lat + (index % 2 === 0 ? 0.06 : -0.06),
            ],
          },
        },
      ];
    }),
  } satisfies GeoJSON.FeatureCollection;
}
