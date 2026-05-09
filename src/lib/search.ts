export type SearchResult = {
  title: string;
  url: string;
  description: string;
  query: string;
  provider: "brave" | "exa";
};

export function stringOrEmpty(value: unknown) {
  return typeof value === "string" ? value : "";
}
