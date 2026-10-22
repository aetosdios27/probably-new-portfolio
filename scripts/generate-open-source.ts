import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fetchOpenSourceHistory } from "../src/lib/open-source-github";

export async function refreshOpenSourceSnapshot({
  path = fileURLToPath(new URL("../src/content/open-source-snapshot.json", import.meta.url)),
  token = process.env.GITHUB_TOKEN ?? "",
  fetcher = fetch,
}: { path?: string; token?: string; fetcher?: typeof fetch } = {}) {
  const items = await fetchOpenSourceHistory({ token, fetcher, signal: AbortSignal.timeout(30_000) });
  const previous: unknown = JSON.parse(await readFile(path, "utf8"));
  if (previous && typeof previous === "object" && "items" in previous && JSON.stringify(previous.items) === JSON.stringify(items)) return;
  // Fetch and validate everything first. Failure leaves the committed fallback untouched.
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify({ checkedAt: new Date().toISOString(), items }, null, 2)}\n`);
  await rename(temporary, path);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await refreshOpenSourceSnapshot();
  console.log("Verified open-source snapshot refreshed.");
}
