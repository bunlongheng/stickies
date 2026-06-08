// Deterministic note/folder icon assignment by keyword + type. Pure + unit-tested
// so the "auto icon" feature can't silently stop matching.

export const NOTE_ICON_KEYWORDS: [string[], string][] = [
    [["deploy","ship","release","launch","rocket","vercel","netlify","ci","cd"], "RocketLaunchIcon"],
    [["email","mail","inbox","gmail","outlook","newsletter","reply","sent"], "EnvelopeIcon"],
    [["pr","review","pull request","merge request","approve","feedback","reviewer"], "CheckCircleIcon"],
    [["ai","llm","gpt","claude","anthropic","openai","ml","model","neural","brain","bot","robot","chatbot","automation"], "RobotIcon"],
    [["docker","container","kubernetes","k8s","pod"], "CubeTransparentIcon"],
    [["security","hack","kali","pentest","vuln","xss","csrf","auth","owasp","shield"], "KeyIcon"],
    [["todo","checklist","task","test","quality","qa","jest","vitest","playwright","coverage","lint"], "ClipboardDocumentListIcon"],
    [["database","db","postgres","sql","supabase","mongo","redis","migration"], "TableCellsIcon"],
    [["api","rest","graphql","endpoint","route","fetch","webhook","http"], "GlobeAltIcon"],
    [["terminal","bash","shell","cli","command","script","zsh","sh"], "CodeBracketIcon"],
    [["cloud","aws","gcp","azure","s3","lambda","serverless"], "CloudIcon"],
    [["network","dns","proxy","nginx","gateway","mcp","socket","websocket"], "GlobeAmericasIcon"],
    [["config","env","settings","setup","install","dotenv","yaml","toml","integrations","integration","plugin","extension"], "WrenchIcon"],
    [["git","github","branch","commit","merge","repo"], "FolderIcon"],
    [["bug","fix","error","debug","issue","crash","exception"], "BugAntIcon"],
    [["design","ui","ux","figma","css","style","theme","color","layout"], "SwatchIcon"],
    [["meeting","standup","sync","agenda","minutes"], "ChatBubbleLeftRightIcon"],
    [["idea","brainstorm","plan","strategy","think","concept"], "LightBulbIcon"],
    [["money","budget","cost","price","billing","invoice","payment"], "BanknotesIcon"],
    [["user","team","people","member","org","staff","hire"], "UserGroupIcon"],
    [["calendar","schedule","deadline","date","event","reminder"], "CalendarDaysIcon"],
    [["link","url","bookmark","resource","reference"], "LinkIcon"],
    [["photo","image","screenshot","pic","camera"], "PhotoIcon"],
    [["music","audio","sound","podcast","spotify"], "MusicalNoteIcon"],
    [["video","film","youtube","stream","record"], "FilmIcon"],
    [["book","read","docs","documentation","wiki","readme"], "BookOpenIcon"],
    [["chart","analytics","metrics","data","dashboard","graph"], "ChartBarIcon"],
    [["diagram","flowchart","mermaid","sequence","mindmap","timeline"], "ShareIcon"],
    [["home","house","personal","family","life"], "HomeIcon"],
    [["work","office","job","career","project"], "BriefcaseIcon"],
    [["code","dev","program","function","module","component","react","next"], "CodeBracketIcon"],
    [["phone","mobile","ios","android","app","pwa"], "DevicePhoneMobileIcon"],
    [["star","favorite","important","priority"], "StarIcon"],
    [["trash","delete","removed","archived","recycle"], "ArchiveBoxIcon"],
    [["demo","example","sample","tutorial","showcase"], "PuzzlePieceIcon"],
];

// Fallback by note `type` when no keyword matches.
export const TYPE_ICON: Record<string, string> = {
    checklist: "__hero:ClipboardDocumentListIcon", code: "__hero:CodeBracketIcon",
    javascript: "__hero:CodeBracketIcon", typescript: "__hero:CodeBracketIcon",
    python: "__hero:CodeBracketIcon", css: "__hero:CodeBracketIcon",
    sql: "__hero:TableCellsIcon", bash: "__hero:CodeBracketIcon",
    markdown: "__hero:BookOpenIcon", mermaid: "__hero:ShareIcon",
    json: "__hero:WrenchIcon", html: "__hero:GlobeAltIcon",
    text: "__hero:DocumentTextIcon",
};

// Last-resort default so EVERY note ends up with an icon.
export const DEFAULT_NOTE_ICON = "__hero:DocumentTextIcon";

// The icon names agents are allowed to send on POST. Curated from the keyword
// table + type fallbacks + a few common extras. All are valid Heroicons (the
// app maps `__hero:<Name>` to @heroicons/react/24/outline). Keeping it a known
// set means notes arrive already-iconed — no later AI pass to classify them.
export const SUPPORTED_NOTE_ICONS: readonly string[] = Array.from(new Set([
    ...NOTE_ICON_KEYWORDS.map(([, icon]) => icon),
    ...Object.values(TYPE_ICON).map(v => v.replace(/^__hero:/, "")),
    // common extras agents may want
    "BellIcon", "FlagIcon", "HeartIcon", "BeakerIcon", "BoltIcon", "CpuChipIcon",
    "DocumentTextIcon", "DocumentDuplicateIcon", "ClipboardIcon", "TagIcon",
    "MapPinIcon", "ClockIcon", "ShieldCheckIcon", "SparklesIcon", "TrophyIcon",
    "ExclamationTriangleIcon", "QuestionMarkCircleIcon", "InboxIcon", "ServerIcon",
])).sort();

const SUPPORTED_SET = new Set(SUPPORTED_NOTE_ICONS.map(n => n.toLowerCase()));

/**
 * Normalize an agent-supplied icon to a supported `__hero:<Name>` value.
 * Accepts "__hero:RocketLaunchIcon", "RocketLaunchIcon", or "rocketlaunchicon"
 * (case-insensitive). Returns null if the icon isn't in the supported set.
 */
export function normalizeIcon(input: unknown): string | null {
    if (typeof input !== "string") return null;
    const bare = input.trim().replace(/^__hero:/i, "");
    if (!bare) return null;
    const match = SUPPORTED_NOTE_ICONS.find(n => n.toLowerCase() === bare.toLowerCase());
    return match ? `__hero:${match}` : null;
}

export function matchNoteIcon(title: string, content?: string): string | null {
    const text = ` ${title} ${(content || "").slice(0, 200)} `.toLowerCase();
    for (const [keywords, icon] of NOTE_ICON_KEYWORDS) {
        if (keywords.some(kw =>
            kw.length <= 3
                ? text.includes(` ${kw} `) || text.includes(`${kw}/`) || text.includes(`/${kw}`)
                : text.includes(kw)
        )) return `__hero:${icon}`;
    }
    return null;
}

/**
 * Resolve the icon for a note: keyword match → type fallback → default.
 * Always returns a usable `__hero:` value (never null), so auto-assign covers
 * 100% of notes.
 */
export function pickNoteIcon(title: string, content: string | undefined, type: string | null | undefined): string {
    return matchNoteIcon(title, content)
        || (type ? TYPE_ICON[type] : undefined)
        || DEFAULT_NOTE_ICON;
}
