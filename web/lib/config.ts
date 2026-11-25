const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const CONFIG = {
  modelSmall: process.env.MODEL_SMALL || "google/gemini-3.5-flash-lite",
  modelBig: process.env.MODEL_BIG || "google/gemini-3.8-flash",
  cacheTtlSeconds: num(process.env.CACHE_TTL_SECONDS, 7200),
  queryTimeoutMs: num(process.env.QUERY_TIMEOUT_MS, 5000),
  maxRows: num(process.env.MAX_ROWS, 50),
  maxRewrites: 2,
  // Placeholder prices in rupees per million tokens. Set real ones from your provider's price list.
  rsPerMtokIn: num(process.env.RS_PER_MTOK_IN, 100),
  rsPerMtokOut: num(process.env.RS_PER_MTOK_OUT, 500),
};
