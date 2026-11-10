import { getLlmsTxt } from "@/lib/agent-document";

export const revalidate = 3600;

export async function GET() {
  return new Response(await getLlmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
