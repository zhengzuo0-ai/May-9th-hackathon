import * as turf from "@turf/turf";
import type { Concession, PublicCompanyProject } from "@/lib/types";

const DEFAULT_RECON_RADIUS_KM = 150;

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
  radiusKm = DEFAULT_RECON_RADIUS_KM,
) {
  const isCoordinateIntake =
    concession.id.startsWith("runtime-") || concession.id === "static-yamoussoukro-point";

  return projects
    .filter((project) => isCoordinateIntake || project.concessionId === concession.id)
    .map((project) => ({
      ...project,
      distanceKm: Math.round(getProjectDistanceKm(concession, project)),
    }))
    .filter((project) => project.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
