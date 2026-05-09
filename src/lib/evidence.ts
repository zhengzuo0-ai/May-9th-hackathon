import type { SourcePack } from "@/lib/types";

export function sourcePackToFact(source: SourcePack) {
  const firstSentence = source.text.split(". ")[0]?.trim() ?? source.text;
  return firstSentence.endsWith(".") ? firstSentence : `${firstSentence}.`;
}
