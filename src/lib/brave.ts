import { stringOrEmpty, type SearchResult } from "@/lib/search";

export type BraveSearchResult = SearchResult;

type BraveWebResult = {
  title?: unknown;
  url?: unknown;
  description?: unknown;
};

type BraveWebResponse = {
  web?: {
    results?: BraveWebResult[];
  };
};

export async function searchBrave(query: string): Promise<BraveSearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  const normalizedQuery = query.trim();

  if (!apiKey || normalizedQuery.length === 0) {
    return [];
  }

  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", normalizedQuery);
  url.searchParams.set("count", "5");
  url.searchParams.set("search_lang", "en");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
    next: { revalidate: 60 * 60 },
  });

  if (!response.ok) {
    throw new Error(`Brave search failed with ${response.status}`);
  }

  const payload = (await response.json()) as BraveWebResponse;
  return normalizeBraveResults(payload, normalizedQuery);
}

export function normalizeBraveResults(
  payload: BraveWebResponse,
  query: string,
): BraveSearchResult[] {
  return (payload.web?.results ?? [])
    .map((result) => ({
      title: stringOrEmpty(result.title),
      url: stringOrEmpty(result.url),
      description: stringOrEmpty(result.description),
      query,
      provider: "brave" as const,
    }))
    .filter((result) => result.title.length > 0 && result.url.length > 0);
}
