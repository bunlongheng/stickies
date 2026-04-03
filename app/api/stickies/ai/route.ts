import Anthropic from "@anthropic-ai/sdk";
import { authorizeOwner } from "../_auth";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
    if (!(await authorizeOwner(req)))
        return new Response("Unauthorized", { status: 401 });

    const { prompt, content, title } = await req.json().catch(() => ({} as any));
    if (!prompt?.trim())
        return new Response("Missing prompt", { status: 400 });

    const userParts: string[] = [];
    if (title?.trim()) userParts.push(`Title: ${title.trim()}`);
    if (content?.trim()) userParts.push(`Current content:\n${content.trim()}`);
    userParts.push(`Instruction: ${prompt.trim()}`);

    const stream = await client.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: "You are a note assistant inside a sticky-notes app. The user gives you an instruction about their note. Do exactly what they ask. Return ONLY the resulting note content — no preamble, no markdown fences, no commentary.",
        messages: [{ role: "user", content: userParts.join("\n\n") }],
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            try {
                for await (const event of stream) {
                    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                        controller.enqueue(encoder.encode(event.delta.text));
                    }
                }
            } catch (e: any) {
                controller.enqueue(encoder.encode(`\n[Error: ${e.message}]`));
            } finally {
                controller.close();
            }
        },
    });

    return new Response(readable, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
    });
}
