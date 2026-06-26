// ============================================================
// types/search.ts — Search domain types
// ============================================================

export type SearchFilter = "all" | "pinyin" | "chars" | "words";

export type SearchFileKey = "pinyin" | "chars" | "words" | "toc";

/** A single search hit. */
export interface SearchResult {
  /** Matched term (pinyin / char / word). */
  term: string;
  /** Canonical padded page id, e.g. "0001" or "A0003". */
  page: string;
  /** Human-readable category label (拼音/单字/词语/目录). */
  type: string;
  /** Which data file the hit came from. */
  key: SearchFileKey;
  /** Lower = better match. Combines base match score + file weight. */
  score: number;
  /** Repo id of the dict this hit belongs to. */
  dictRepo: string;
}

export interface SearchOptions {
  limit?: number;
  filter?: SearchFilter;
  repo?: string;
}

/** Options passed to the highlight helper. */
export interface HighlightOptions {
  /** Wrap matched substring in this tag (default "mark"). */
  tag?: string;
  /** Extra class on the wrapper. */
  className?: string;
  /** Case-insensitive match (default true). */
  caseInsensitive?: boolean;
}
