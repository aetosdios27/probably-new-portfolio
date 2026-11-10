import { NextResponse, type NextRequest } from "next/server";

// Agents that ask for markdown get the whole site as markdown from any page; everyone else gets the
// page, with a Link header saying where the markdown lives. Pure logic, exported for the tests.
export function prefersMarkdown(accept: string | null) {
  if (!accept) return false;
  let markdown = 0, html = 0;
  for (const part of accept.split(",")) {
    const [type, ...params] = part.trim().toLowerCase().split(";");
    const q = Number(params.map((p) => p.trim()).find((p) => p.startsWith("q="))?.slice(2) ?? 1);
    if (type === "text/markdown" || type === "text/x-markdown") markdown = Math.max(markdown, q);
    if (type === "text/html") html = Math.max(html, q);
  }
  return markdown > 0 && markdown >= html;
}

export function proxy(request: NextRequest) {
  const response = prefersMarkdown(request.headers.get("accept"))
    ? NextResponse.rewrite(new URL("/index.md", request.url))
    : NextResponse.next();
  response.headers.set("Vary", "Accept");
  response.headers.set("Link", '</index.md>; rel="alternate"; type="text/markdown", </llms.txt>; rel="describedby"; type="text/plain"');
  return response;
}

export const config = {
  // Pages only: not Next's own assets, not files with an extension (images, the PDF, index.md itself).
  matcher: ["/((?!_next/|.*\\.[a-z0-9]+$).*)"],
};
