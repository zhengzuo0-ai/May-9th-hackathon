"use client";

import { useEffect, useRef } from "react";
import maplibregl, { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import * as turf from "@turf/turf";
import type { Concession, PublicCompanyProject, SourcePack } from "@/lib/types";

type ProjectWithDistance = PublicCompanyProject & { distanceKm: number };

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
    satellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [
    {
      id: "satellite",
      type: "raster",
      source: "satellite",
      paint: {
        "raster-saturation": -0.1,
        "raster-contrast": 0.18,
        "raster-brightness-min": 0,
        "raster-brightness-max": 0.78,
      },
    },
  ],
} as maplibregl.StyleSpecification;

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
      center: [22.5, -22.2],
      zoom: 4.4,
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
          "circle-color": "#d98b4a",
          "circle-radius": 13,
          "circle-opacity": 0.12,
          "circle-stroke-color": "#d98b4a",
          "circle-stroke-opacity": 0.35,
          "circle-stroke-width": 1,
        },
      });
      map.addLayer({
        id: "project-pins",
        type: "circle",
        source: "projects",
        paint: {
          "circle-color": "#d98b4a",
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

      map.on("click", "concession-fill", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") onSelectRef.current(id);
      });

      map.on("mouseenter", "concession-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "concession-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "project-pins", (event) => {
        const feature = event.features?.[0];
        if (!feature) return;
        new maplibregl.Popup()
          .setLngLat(event.lngLat)
          .setHTML(
            `<div class="recon-popup"><strong>${feature.properties?.project}</strong><span>${feature.properties?.company}</span><em>${feature.properties?.distanceKm}km from selected block</em></div>`,
          )
          .addTo(map);
      });

      map.on("mouseenter", "project-pins", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "project-pins", () => {
        map.getCanvas().style.cursor = "";
      });
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

  return <div ref={containerRef} className="h-full w-full" />;
}

function updateSource(map: MapLibreMap, id: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  source?.setData(data);
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
    turf.circle(center, 100, {
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
      },
      geometry: {
        type: "Point",
        coordinates: [project.lng, project.lat],
      },
    })),
  } satisfies GeoJSON.FeatureCollection;
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
