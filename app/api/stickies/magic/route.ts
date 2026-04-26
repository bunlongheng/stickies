import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { query, execute } from "@/lib/db-driver";
import { authorizeOwner } from "@/app/api/stickies/_auth";

const OWNER = () => process.env.OWNER_USER_ID?.trim() ?? "";

// All available Heroicon names for the AI to pick from
const ICON_NAMES = [
    "AcademicCapIcon","AdjustmentsHorizontalIcon","ArchiveBoxIcon","ArrowTrendingUpIcon",
    "BanknotesIcon","BeakerIcon","BellIcon","BoltIcon","BookOpenIcon","BookmarkIcon",
    "BriefcaseIcon","BugAntIcon","BuildingOfficeIcon","CakeIcon","CalculatorIcon",
    "CalendarDaysIcon","CameraIcon","ChartBarIcon","ChartPieIcon","ChatBubbleLeftRightIcon",
    "CheckCircleIcon","CircleStackIcon","ClipboardDocumentListIcon","CloudIcon",
    "CodeBracketIcon","Cog6ToothIcon","CommandLineIcon","ComputerDesktopIcon",
    "CpuChipIcon","CubeTransparentIcon","CurrencyDollarIcon","DevicePhoneMobileIcon",
    "DocumentTextIcon","EnvelopeIcon","EyeIcon","FaceSmileIcon","FilmIcon","FireIcon",
    "FlagIcon","FolderIcon","GlobeAltIcon","GlobeAmericasIcon","HandThumbUpIcon",
    "HeartIcon","HomeIcon","KeyIcon","LanguageIcon","LightBulbIcon","LinkIcon",
    "LockClosedIcon","MagnifyingGlassIcon","MapIcon","MapPinIcon","MegaphoneIcon",
    "MicrophoneIcon","MoonIcon","MusicalNoteIcon","NewspaperIcon","PaintBrushIcon",
    "PaperAirplaneIcon","PencilSquareIcon","PhotoIcon","PlayIcon","PresentationChartBarIcon",
    "PuzzlePieceIcon","QrCodeIcon","QueueListIcon","RadioIcon","RectangleStackIcon",
    "RocketLaunchIcon","ScaleIcon","ScissorsIcon","ServerIcon","ShareIcon",
    "ShieldCheckIcon","ShoppingCartIcon","SignalIcon","SparklesIcon","SpeakerWaveIcon",
    "StarIcon","SunIcon","SwatchIcon","TableCellsIcon","TagIcon","TicketIcon",
    "TrophyIcon","TruckIcon","TvIcon","UserGroupIcon","UserIcon","VideoCameraIcon",
    "WifiIcon","WrenchIcon","WrenchScrewdriverIcon","RobotIcon",
];

export async function POST(req: Request) {
    if (!await authorizeOwner(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const folderName = String(body.folder_name ?? "").trim();
    if (!folderName) return NextResponse.json({ error: "folder_name required" }, { status: 400 });

    const userId = OWNER();

    // Get all notes in this folder (title + first 200 chars of content)
    const notes = await query<{ id: string; title: string; content: string; icon: string | null; type: string }>(
        `SELECT id, title, SUBSTRING(content FROM 1 FOR 200) AS content, icon, type FROM "stickies" WHERE is_folder = false AND folder_name = $1 AND user_id = $2 ORDER BY updated_at DESC`,
        [folderName, userId]
    );

    // Get subfolders
    const subfolders = await query<{ id: string; folder_name: string; content: string }>(
        `SELECT id, folder_name, content FROM "stickies" WHERE is_folder = true AND parent_folder_name = $1 AND user_id = $2`,
        [folderName, userId]
    );

    // Build prompt for Claude
    const items: { id: string; type: "note" | "folder"; name: string; preview: string; hasIcon: boolean; currentTitle?: string }[] = [];

    for (const n of notes) {
        items.push({
            id: n.id,
            type: "note",
            name: n.title || "Untitled",
            preview: (n.content || "").slice(0, 150),
            hasIcon: !!n.icon,
            currentTitle: n.title,
        });
    }

    for (const f of subfolders) {
        // Get note titles inside subfolder for context
        const subNotes = await query<{ title: string }>(
            `SELECT title FROM "stickies" WHERE is_folder = false AND folder_name = $1 AND user_id = $2 LIMIT 5`,
            [f.folder_name, userId]
        );
        const preview = subNotes.map(n => n.title).join(", ");
        items.push({
            id: f.id,
            type: "folder",
            name: f.folder_name,
            preview,
            hasIcon: !!f.content?.startsWith("__hero:"),
        });
    }

    if (items.length === 0) {
        return NextResponse.json({ updated: 0, message: "No items to process" });
    }

    // Only process items that don't already have icons
    const needsWork = items.filter(i => !i.hasIcon);

    if (needsWork.length === 0) {
        return NextResponse.json({ updated: 0, message: "No items in folder" });
    }

    const client = new Anthropic({ apiKey });
    const prompt = `You are assigning icons and improving titles for a notes app.

Available icons (Heroicon names): ${ICON_NAMES.join(", ")}

For each item below, pick the SINGLE BEST icon from the list above. Also, if the title is missing, "Untitled", or unclear, suggest a better concise title (max 60 chars, no dashes at start/end).

Items:
${needsWork.map((item, i) => `${i + 1}. [${item.type}] "${item.name}" — ${item.preview || "no content"}`).join("\n")}

Respond ONLY with a JSON array, no explanation:
[{"index":1,"icon":"IconName","title":"Better Title or null if current is fine"},...]

Rules:
- Pick the most semantically fitting icon for the content
- If current title is already good, set title to null
- No dashes at start/end of titles
- Keep titles concise and clear`;

    try {
        const response = await client.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            messages: [{ role: "user", content: prompt }],
        });

        const text = response.content[0]?.type === "text" ? response.content[0].text : "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return NextResponse.json({ error: "AI returned invalid format", raw: text }, { status: 500 });

        // Clean up common JSON issues from AI output
        const cleaned = jsonMatch[0]
            .replace(/,\s*]/g, "]")           // trailing commas
            .replace(/,\s*}/g, "}")           // trailing commas in objects
            .replace(/\/\/[^\n]*/g, "")       // line comments
            .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
            .replace(/[\x00-\x1f]/g, " ");    // control chars

        let assignments: { index: number; icon: string; title: string | null }[];
        try {
            assignments = JSON.parse(cleaned);
        } catch {
            // Last resort: try to extract individual objects
            const items = [...cleaned.matchAll(/\{[^}]+\}/g)].map(m => { try { return JSON.parse(m[0]); } catch { return null; } }).filter(Boolean);
            if (items.length === 0) return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
            assignments = items as any;
        }
        let updated = 0;

        for (const a of assignments) {
            const item = needsWork[a.index - 1];
            if (!item) continue;
            const iconValue = ICON_NAMES.includes(a.icon) ? `__hero:${a.icon}` : null;

            if (item.type === "note") {
                const updates: string[] = [];
                const params: unknown[] = [];
                let paramIdx = 1;

                if (iconValue) {
                    updates.push(`icon = $${paramIdx++}`);
                    params.push(iconValue);
                }
                if (a.title && a.title !== item.currentTitle) {
                    updates.push(`title = $${paramIdx++}`);
                    params.push(a.title);
                }
                if (updates.length > 0) {
                    params.push(item.id);
                    await execute(`UPDATE "stickies" SET ${updates.join(", ")} WHERE id = $${paramIdx}`, params);
                    updated++;
                }
            } else {
                // Folder — icon stored in content field
                if (iconValue) {
                    await execute(`UPDATE "stickies" SET content = $1 WHERE id = $2`, [iconValue, item.id]);
                    updated++;
                }
            }
        }

        return NextResponse.json({ updated, assignments: assignments.length, items: needsWork.length });
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `AI error: ${msg}` }, { status: 500 });
    }
}
