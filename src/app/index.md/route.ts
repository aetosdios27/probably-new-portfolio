import { getAgentMarkdown } from "@/lib/agent-document";

export const revalidate = 3600;

export async function GET() {
  return new Response(await getAgentMarkdown(), {
    headers: { "Content-Type": "text/markdown; charset=utf-8", "Vary": "Accept" },
  });
}
