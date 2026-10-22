import { unstable_cache } from "next/cache";
import { openSource } from "@/content/portfolio";
import snapshot from "@/content/open-source-snapshot.json";
import { OPEN_SOURCE_AUTHOR, OPEN_SOURCE_ORGANIZATIONS, selectContributions } from "./open-source-policy";
import { fetchOpenSourceHistory } from "./open-source-github";

const descriptions = Object.fromEntries(openSource.map((item) => [item.href, item.description]));

// Cache validated results, not HTTP responses: a 200 with unusable data must never
// replace a good feed. Failed hourly refreshes leave the previous cache value intact.
const getCachedContributions = unstable_cache(
  async () => selectContributions(await fetchOpenSourceHistory({ token: process.env.GITHUB_TOKEN ?? "" }), descriptions),
  ["authored-contributions-v1", OPEN_SOURCE_AUTHOR, JSON.stringify(OPEN_SOURCE_ORGANIZATIONS), JSON.stringify(descriptions)],
  { revalidate: 3600 },
);

export async function getOpenSourceContributions() {
  try {
    return await getCachedContributions();
  } catch (error) {
    // A fresh deployment may have no successful cached result yet.
    console.warn("[open-source] Using verified snapshot:", error instanceof Error ? error.message : "Refresh failed");
    return selectContributions(snapshot.items, descriptions);
  }
}
