import * as turf from "@turf/turf";
import type { Concession, PublicCompanyProject } from "@/lib/types";

export function getConcessionCentroid(concession: Concession): [number, number] {
  const point = turf.centroid(concession.polygon);
  return point.geometry.coordinates as [number, number];
}

export function getProjectDistanceKm(
  concession: Concession,
  project: PublicCompanyProject,
) {
  const center = getConcessionCentroid(concession);
  return turf.distance(center, [project.lng, project.lat], {
    units: "kilometers",
  });
}

export function getNearbyProjects(
  concession: Concession,
  projects: PublicCompanyProject[],
  radiusKm = 320,
) {
  return projects
    .filter((project) => project.concessionId === concession.id)
    .map((project) => ({
      ...project,
      distanceKm: Math.round(getProjectDistanceKm(concession, project)),
    }))
    .filter((project) => project.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
