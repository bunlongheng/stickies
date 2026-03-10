/**
 * Seed sample mermaid diagrams into the CLAUDE folder.
 * Run: node scripts/seed-diagrams.mjs
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const API = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/api/stickies`
    : "http://localhost:4444/api/stickies";
const KEY = process.env.STICKIES_API_KEY;

if (!KEY) { console.error("Missing STICKIES_API_KEY in .env.local"); process.exit(1); }

const diagrams = [
  {
    title: "System Architecture",
    folder: "CLAUDE",
    content: `flowchart TD
    Client([🌐 Browser / Mobile]) --> CDN[Vercel Edge CDN]
    CDN --> Next[Next.js App Router]
    Next --> API[/api/stickies]
    Next --> HueAPI[/api/hue/trigger]
    API --> Supabase[(Supabase DB)]
    API --> Pusher{{Pusher Realtime}}
    API --> Drive[Google Drive]
    HueAPI --> Bridge[Philips Hue Bridge]
    Bridge --> Lights([💡 Lights])
    Pusher --> Client
    style Client fill:#007AFF,color:#fff,stroke:none
    style Lights fill:#FFCC00,color:#000,stroke:none
    style Supabase fill:#3ECF8E,color:#000,stroke:none
    style Pusher fill:#5856D6,color:#fff,stroke:none
    style Bridge fill:#FF9500,color:#000,stroke:none`,
  },
  {
    title: "Note Lifecycle",
    folder: "CLAUDE",
    content: `sequenceDiagram
    actor User
    participant FE as Frontend
    participant API as /api/stickies
    participant DB as Supabase
    participant Push as Pusher
    participant Hue as Hue Bridge

    User->>FE: Type note + save
    FE->>API: POST Bearer token
    API->>DB: INSERT note
    DB-->>API: row data
    API->>Push: trigger note-created
    API->>Hue: flash color (non-browser)
    Push-->>FE: realtime update
    Hue-->>User: 💡 light flash
    FE-->>User: note appears in list`,
  },
  {
    title: "Note State Machine",
    folder: "CLAUDE",
    content: `stateDiagram-v2
    [*] --> Draft : open editor
    Draft --> Saved : blur / cmd+s
    Saved --> Draft : edit
    Saved --> Checklist : toggle list_mode
    Checklist --> Saved : toggle off
    Saved --> Deleted : delete
    Deleted --> [*]
    Draft --> [*] : discard

    state Draft {
        Typing --> AutoSave : 800ms idle
        AutoSave --> Typing : keystroke
    }`,
  },
  {
    title: "bheng Stack",
    folder: "CLAUDE",
    content: `flowchart LR
    subgraph Frontend
        Next[Next.js 14]
        Tail[Tailwind CSS]
        Tiptap[TipTap Editor]
        Mermaid[Mermaid.js]
    end
    subgraph Backend
        API[Route Handlers]
        Auth[Supabase Auth]
        RT[Pusher Realtime]
    end
    subgraph Storage
        DB[(Supabase Postgres)]
        GD[Google Drive]
    end
    subgraph Infra
        Vercel[Vercel Edge]
        PM2[PM2 Local]
    end
    Frontend --> Backend
    Backend --> Storage
    Vercel --> Frontend
    PM2 --> Frontend
    style Next fill:#000,color:#fff,stroke:#fff
    style Tail fill:#38bdf8,color:#000,stroke:none
    style DB fill:#3ECF8E,color:#000,stroke:none
    style Vercel fill:#000,color:#fff,stroke:#fff
    style PM2 fill:#34C759,color:#000,stroke:none`,
  },
  {
    title: "Folder Depth Model",
    folder: "CLAUDE",
    content: `flowchart TD
    Root([🌳 Root L1]) --> F1[CLAUDE]
    Root --> F2[TEAM]
    Root --> F3[DEMO]
    F1 --> F1a[SKILLS]
    F1 --> F1b[LEARN]
    F1 --> N1((note))
    F2 --> N2((note))
    F2 --> N3((note))
    F1a --> N4((note))
    F1b --> N5((note))

    classDef folder fill:#5856D6,color:#fff,stroke:none
    classDef note fill:#1a1a2e,color:#a1a1aa,stroke:#3f3f46
    classDef root fill:#007AFF,color:#fff,stroke:none
    class F1,F2,F3 folder
    class F1a,F1b folder
    class N1,N2,N3,N4,N5 note
    class Root root`,
  },
];

for (const d of diagrams) {
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Authorization": `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
    const json = await res.json();
    console.log(`✓ ${json.action}: ${json.note?.title}`);
  } catch (e) {
    console.error(`✗ ${d.title}:`, e.message);
  }
}
