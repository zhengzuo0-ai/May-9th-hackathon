export type CountryCode = "BW" | "NA";

export type Concession = {
  id: string;
  name: string;
  country: CountryCode;
  center: [number, number];
  polygon: GeoJSON.Polygon;
};

export type PublicCompanyProject = {
  id: string;
  concessionId: string;
  company: string;
  ticker: string;
  exchange: string;
  project: string;
  country: CountryCode;
  lat: number;
  lng: number;
  commodities: string[];
  sourceUrls: string[];
};

export type SourcePack = {
  id: string;
  concessionId: string;
  projectId: string;
  company: string;
  project: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceType:
    | "asx"
    | "tsx"
    | "company_page"
    | "presentation"
    | "annual_report"
    | "news_release";
  retrievedAt: string;
  text: string;
};

export type EvidenceItem = {
  id: string;
  sourceUrl: string;
  sourceTitle: string;
  company: string;
  project: string;
  date?: string;
  evidenceType:
    | "drilling_result"
    | "resource_estimate"
    | "license_activity"
    | "infrastructure"
    | "corporate_activity";
  summary: string;
  extractedFacts: {
    commodity?: string;
    intercept?: string;
    grade?: string;
    depth?: string;
    distanceKm?: number;
  };
  confidence: "high" | "medium" | "low";
};
