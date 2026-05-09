import { stringOrEmpty, type SearchResult } from "@/lib/search";

type ExaResult = {
  title?: unknown;
  url?: unknown;
  text?: unknown;
  highlights?: unknown;
  summary?: unknown;
};

type ExaResponse = {
  results?: ExaResult[];
};

export type ExaSearchResult = SearchResult;

export async function searchExa(query: string): Promise<ExaSearchResult[]> {
  const apiKey = process.env.EXA_API_KEY;
  const normalizedQuery = query.trim();

  if (!apiKey || normalizedQuery.length === 0) {
    return [];
  }

  const response = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      query: normalizedQuery,
      type: "auto",
      numResults: 5,
      contents: {
        highlights: true,
      },
    }),
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) {
    throw new Error(`Exa search failed with ${response.status}`);
  }

  const payload = (await response.json()) as ExaResponse;
  return normalizeExaResults(payload, normalizedQuery);
}

export function normalizeExaResults(
  payload: ExaResponse,
  query: string,
): ExaSearchResult[] {
  return (payload.results ?? [])
    .map((result) => {
      const url = stringOrEmpty(result.url);

      return {
        title: stringOrEmpty(result.title) || titleFromUrl(url),
        url,
        description:
          highlightText(result.highlights) ||
          stringOrEmpty(result.summary) ||
          stringOrEmpty(result.text),
        query,
        provider: "exa" as const,
      };
    })
    .filter((result) => result.url.length > 0);
}

function highlightText(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join(" ");
  }

  return stringOrEmpty(value);
}

function titleFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
