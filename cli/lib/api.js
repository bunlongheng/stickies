/**
 * Send a note to the Stickies API.
 * Returns { id, title } on success, throws on failure.
 */
export async function createNote(payload) {
  const url = process.env.STICKIES_API_URL;
  const token = process.env.STICKIES_API_TOKEN;

  if (!url) throw new Error("STICKIES_API_URL is not set");
  if (!token) throw new Error("STICKIES_API_TOKEN is not set");

  const endpoint = url.replace(/\/$/, "") + "/api/stickies/ext";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json();
  return { id: data.note?.id ?? data.id ?? null, title: payload.title };
}
