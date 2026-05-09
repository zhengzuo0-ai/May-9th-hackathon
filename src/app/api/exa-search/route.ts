import { NextResponse } from "next/server";
import { searchExa } from "@/lib/exa";

type ExaSearchRequest = {
  query?: unknown;
  queries?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExaSearchRequest;
    const queries = normalizeQueries(body);
    const results = (await Promise.all(queries.map((query) => searchExa(query)))).flat();

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Exa search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function normalizeQueries(body: ExaSearchRequest) {
  if (Array.isArray(body.queries)) {
    return body.queries.filter((query): query is string => typeof query === "string");
  }

  return typeof body.query === "string" ? [body.query] : [];
}
