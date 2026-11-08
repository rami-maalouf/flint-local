// the waitlist: adds an email to the shared orbit labs notion waitlist, tagged app "flint" and
// the platforms the person picked. one row per email for flint: a second signup with the same
// email adds any new platform to that row instead of making a duplicate. other apps' rows for
// the same email are left alone.
// needs NOTION_API_KEY and NOTION_WAITLIST_DATASOURCE_ID in the vercel project.

// vercel's edge runtime provides process.env; declared here so the function needs no node types
declare const process: { env: Record<string, string | undefined> };

export const config = { runtime: "edge" };

const APP = "flint";
const PLATFORMS = ["iOS", "Android"] as const;
type Platform = (typeof PLATFORMS)[number];

const NOTION = "https://api.notion.com/v1";
const NOTION_VERSION = "2025-09-03";

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function readPlatforms(value: unknown): Platform[] {
  if (!Array.isArray(value)) return [];
  return PLATFORMS.filter((p) => value.includes(p));
}

export default async function handler(request: Request) {
  if (request.method !== "POST") return reply(405, { error: "Method not allowed" });

  let body: { email?: unknown; platforms?: unknown; company?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: "Send the form again." });
  }

  // a field people never see: a bot that fills it gets a quiet success and no row
  if (typeof body.company === "string" && body.company.length > 0) return reply(200, { ok: true });

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply(400, { error: "Use a valid email address." });
  }
  const platforms = readPlatforms(body.platforms);
  if (platforms.length === 0) return reply(400, { error: "Pick iPhone, Android, or both." });

  const key = process.env.NOTION_API_KEY;
  const dataSource = process.env.NOTION_WAITLIST_DATASOURCE_ID;
  if (!key || !dataSource) return reply(500, { error: "The waitlist is not set up yet. Try again later." });

  const notion = (path: string, method: string, payload: unknown) =>
    fetch(`${NOTION}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

  try {
    const found = await notion(`/data_sources/${dataSource}/query`, "POST", {
      filter: {
        and: [
          { property: "Email", title: { equals: email } },
          { property: "App", multi_select: { contains: APP } },
        ],
      },
      page_size: 1,
    });
    if (!found.ok) throw new Error(`query ${found.status}`);
    const existing = (await found.json()).results?.[0];

    if (existing) {
      const had: string[] = (existing.properties?.Platform?.multi_select ?? []).map((o: { name: string }) => o.name);
      const added = platforms.filter((p) => !had.includes(p));
      if (added.length > 0) {
        const updated = await notion(`/pages/${existing.id}`, "PATCH", {
          properties: { Platform: { multi_select: [...had, ...added].map((name) => ({ name })) } },
        });
        if (!updated.ok) throw new Error(`update ${updated.status}`);
      }
      return reply(200, { ok: true, alreadyAdded: true, added });
    }

    const created = await notion("/pages", "POST", {
      parent: { type: "data_source_id", data_source_id: dataSource },
      properties: {
        Email: { title: [{ text: { content: email } }] },
        Date: { date: { start: new Date().toISOString() } },
        Platform: { multi_select: platforms.map((name) => ({ name })) },
        App: { multi_select: [{ name: APP }] },
      },
    });
    if (!created.ok) throw new Error(`create ${created.status}`);
    return reply(200, { ok: true, alreadyAdded: false });
  } catch (error) {
    console.error("waitlist", error instanceof Error ? error.message : error);
    return reply(502, { error: "We could not save that. Try again in a minute." });
  }
}
