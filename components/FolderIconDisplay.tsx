import React from "react";
import * as HeroOutline from "@heroicons/react/24/outline";
import { appIconForKey } from "@/lib/app-icons";

// The audit-family combined marks - each is a search glass with a distinct inner icon.
// They ALL share the exact same lens geometry (circle r=9 + handle) and MUST render at
// the same tile size, so none looks smaller than another. This is the SINGLE source of
// truth: add every new audit-glass token here, and NoteTileIcon sizes them uniformly.
export const AUDIT_GLASS_ICONS = new Set([
    "__portfolioaudit", "__githubaudit", "__repoaudit", "__githubstats",
    "__praudit", "__reporecon", "__securityaudit", "__epicaudit", "__repotest",
    "__projectaudit", "__devaudit", "__storageaudit", "__resourceaudit", "__skillaudit",
    // pr-stats dashboards (not glass marks, but share the 23px full-size render)
    "__prtrends", "__prsummary",
]);

// Custom robot glyph (not in Heroicons) used for AI/robot folders and notes.
export const RobotIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
        <rect width="20" height="14" x="2" y="9" rx="4"/><circle cx="12" cy="3" r="2"/><path d="M12 5v4m-3 8v-2m6 0v2"/>
    </svg>
);

// All ~324 Heroicons (outline) for the folder icon picker, stored as "__hero:StarIcon".
export const FOLDER_HERO_ICONS: { key: string; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = Object.entries(HeroOutline)
    .filter(([key]) => key.endsWith("Icon") && key !== "default")
    .map(([key, Icon]) => ({
        key,
        label: key.replace(/Icon$/, "").replace(/([A-Z])/g, " $1").trim().toLowerCase(),
        Icon: Icon as React.ComponentType<React.SVGProps<SVGSVGElement>>,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
FOLDER_HERO_ICONS.push({ key: "RobotIcon", label: "robot", Icon: RobotIcon as React.ComponentType<React.SVGProps<SVGSVGElement>> });

const HERO_ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = Object.fromEntries(FOLDER_HERO_ICONS.map(e => [e.key, e.Icon]));

// Render a folder/note icon value - hero icons stored as "__hero:IconName", brand
// marks as "__claude/__github/__gmail/__linkedin", images as base64/URL, else initial.
export function FolderIconDisplay({ value, folderName, className = "w-4 h-4" }: { value: string; folderName: string; className?: string }) {
    if (value === "__claude") {
        return <img src="/claude-icon.png" alt="Claude" className={className} style={{ objectFit: "contain" }} />;
    }
    if (value === "__github") {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="GitHub">
                <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
        );
    }
    if (value === "__gmail") {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Gmail">
                <rect x="2" y="5" width="20" height="14" rx="2.5" />
                <path d="M2.5 6 12 13 21.5 6" />
                <path d="M6 18 V9 l6 4.5 L18 9 v9" />
            </svg>
        );
    }
    if (value === "__linkedin") {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="LinkedIn">
                <rect x="2.5" y="2.5" width="19" height="19" rx="4.5" />
                <circle cx="8" cy="8.2" r="0.9" />
                <path d="M8 11 v6" />
                <path d="M11.5 17 v-6" />
                <path d="M11.5 13.5 c.5-1.6 1.7-2.5 3.1-2.5 1.7 0 2.4 1.2 2.4 3 V17" />
            </svg>
        );
    }
    if (value === "__portfolioaudit") {
        // Combined mark for /portfolio-audit notes: a globe inside a magnifying glass
        // (a portfolio is a website). Rendered in code (currentColor, heroicon 1.5 stroke).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Portfolio audit">
                <circle cx="10.5" cy="10.5" r="9" />
                <line x1="21" y1="21" x2="17" y2="17" />
                <circle cx="10.5" cy="10.5" r="4.2" />
                <line x1="6.3" y1="10.5" x2="14.7" y2="10.5" />
                <ellipse cx="10.5" cy="10.5" rx="1.7" ry="4.2" />
            </svg>
        );
    }
    if (value === "__githubaudit") {
        // Magnifying glass with the GitHub octocat inside the lens (a /github-audit report).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="GitHub audit">
                <circle cx="10.5" cy="10.5" r="9" />
                <line x1="21" y1="21" x2="17" y2="17" />
                <g transform="translate(4.9 4.6) scale(0.47)" strokeWidth={2.58}>
                    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
                    <path d="M9 18c-4.51 2-5-2-7-2" />
                </g>
            </svg>
        );
    }
    if (value === "__repoaudit") {
        // Magnifying glass with a folder centered in the lens (a /repo-audit report).
        // Folder only - an octocat nested inside the folder is illegible / smudges at
        // tile size, so the folder (repo) carries the meaning; /github-audit is the octocat.
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Repo audit">
                <circle cx="10.5" cy="10.5" r="9" />
                <line x1="21" y1="21" x2="17" y2="17" />
                <path d="M7.4 7.6h1.9l.85 .95h3.55a.8 .8 0 0 1 .8 .8v3.3a.8 .8 0 0 1-.8 .8H7.4a.8 .8 0 0 1-.8-.8V8.4a.8 .8 0 0 1 .8-.8z" />
            </svg>
        );
    }
    if (value === "__skillaudit") {
        // A jigsaw puzzle piece inside a magnifying glass (a /skill-audit report -
        // each skill is a puzzle piece, the glass audits it).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Skill audit">
                <circle cx="10.5" cy="10.5" r="9" />
                <line x1="21" y1="21" x2="17" y2="17" />
                <path d="M7.2 8.4 H8.8 a1.1 1.1 0 1 1 2.2 0 H12.6 V9.9 a1.1 1.1 0 1 1 0 2.2 V13.4 H7.2 Z" />
            </svg>
        );
    }
    if (value === "__githubstats") {
        // A user inside a magnifying glass (a /github-stats report - it profiles a person's
        // GitHub), with a mini GitHub octocat at the corner. The octocat disambiguates it
        // from /dev-audit (which is also a user-in-glass) and names the GitHub source.
        return (
            <svg viewBox="0 0 24 24" className={className} aria-label="GitHub stats">
                {/* user inside a compact glass, top-left */}
                <g fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="8.2" cy="9" r="6.8" />
                    <line x1="12.9" y1="13.7" x2="14.3" y2="15.1" />
                    <circle cx="8.2" cy="7.2" r="1.5" />
                    <path d="M5.3 12c0-1.8 1.3-2.7 2.9-2.7s2.9 .9 2.9 2.7" />
                </g>
                {/* the real GitHub octocat mark - big, to the right, clear of the glass */}
                <path fill="currentColor" transform="translate(15.2,12.2) scale(0.42)" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
        );
    }
    if (value === "__prtrends") {
        // Bar chart + a git-branch node (a /zeta-pr-stats "PR trends" report - 3PI).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="PR trends">
                <rect x="3.5" y="11.5" width="3" height="6.5" rx="0.6" />
                <rect x="8" y="6.5" width="3" height="11.5" rx="0.6" />
                <rect x="12.5" y="9" width="3" height="9" rx="0.6" />
                <circle cx="18.5" cy="9.3" r="1.25" /><circle cx="18.5" cy="16.7" r="1.25" />
                <line x1="18.5" y1="10.55" x2="18.5" y2="15.45" />
                <circle cx="22" cy="13" r="1.25" />
                <path d="M18.5 13 H20.75" />
            </svg>
        );
    }
    if (value === "__prsummary") {
        // Pie chart + a git-branch node (an /ipaas-pr-stats "PR summary" dashboard - iPaaS).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="PR summary">
                <path d="M9.5 4.5a6.5 6.5 0 1 0 6.5 6.5" />
                <path d="M11.2 3.1a6.5 6.5 0 0 1 5.2 5.2L11 9.5Z" />
                <circle cx="18.5" cy="12.3" r="1.15" /><circle cx="18.5" cy="18.5" r="1.15" />
                <line x1="18.5" y1="13.45" x2="18.5" y2="17.35" />
                <circle cx="21.6" cy="15.4" r="1.15" />
                <path d="M18.5 15.4 H20.45" />
            </svg>
        );
    }
    if (value === "__praudit") {
        // Code brackets </> inside a magnifying glass (a /pr-audit report).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="PR audit">
                <circle cx="10.5" cy="10.5" r="9" />
                <line x1="21" y1="21" x2="17" y2="17" />
                <path d="M8.6 8.4L6.4 10.5L8.6 12.6" />
                <path d="M12.4 8.4L14.6 10.5L12.4 12.6" />
                <path d="M11.2 7.9L9.8 13.1" />
            </svg>
        );
    }
    if (value === "__reporecon") {
        // An eye inside a magnifying glass (a /repo-recon report - reconnaissance of a repo).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Repo recon">
                <circle cx="10.5" cy="10.5" r="9" />
                <line x1="21" y1="21" x2="17" y2="17" />
                <path d="M5.8 10.5C7 8.7 8.6 7.8 10.5 7.8s3.5 .9 4.7 2.7c-1.2 1.8-2.8 2.7-4.7 2.7s-3.5-.9-4.7-2.7z" />
                <circle cx="10.5" cy="10.5" r="1.6" />
            </svg>
        );
    }
    if (value === "__securityaudit") {
        // A padlock inside a magnifying glass (a /security-audit report).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Security audit">
                <circle cx="10.5" cy="10.5" r="9" />
                <line x1="21" y1="21" x2="17" y2="17" />
                <path d="M8.9 9.8V8.4a1.6 1.6 0 0 1 3.2 0v1.4" />
                <path d="M7.9 9.8h5.2a.8 .8 0 0 1 .8 .8v2.8a.8 .8 0 0 1-.8 .8H7.9a.8 .8 0 0 1-.8-.8v-2.8a.8 .8 0 0 1 .8-.8z" />
            </svg>
        );
    }
    if (value === "__epicaudit") {
        // An org-chart (epic -> stories) inside a magnifying glass (a /epic-audit report).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Epic audit">
                <circle cx="10.5" cy="10.5" r="9" />
                <line x1="21" y1="21" x2="17" y2="17" />
                <rect x="8.3" y="7.0" width="4.4" height="2.2" rx=".4" />
                <path d="M10.5 9.2V10.3" /><path d="M7.6 10.3H13.4" /><path d="M7.6 10.3V11.3" /><path d="M13.4 10.3V11.3" />
                <rect x="6.1" y="11.3" width="3" height="1.8" rx=".4" />
                <rect x="11.9" y="11.3" width="3" height="1.8" rx=".4" />
            </svg>
        );
    }
    if (value === "__projectaudit") {
        // Stacked folders inside a magnifying glass (a /project-audit report - many repos).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Project audit">
                <circle cx="10.5" cy="10.5" r="9" />
                <line x1="21" y1="21" x2="17" y2="17" />
                <path d="M9 8.4h1.4l.6 .7h2.7a.65 .65 0 0 1 .65 .65v2.4a.65 .65 0 0 1-.65 .65" />
                <path d="M6.9 10.6h1.4l.6 .7h2.7a.65 .65 0 0 1 .65 .65v2.35a.65 .65 0 0 1-.65 .65H6.9a.65 .65 0 0 1-.65-.65v-3.05a.65 .65 0 0 1 .65-.65z" />
            </svg>
        );
    }
    if (value === "__devaudit") {
        // A developer (user with a code mark on the chest) inside a magnifying glass (/dev-audit).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Dev audit">
                <circle cx="10.5" cy="10.5" r="9" />
                <line x1="21" y1="21" x2="17" y2="17" />
                <circle cx="10.5" cy="6.4" r="1.5" />
                <path d="M7.3 12.0c0-1.95 1.45-3.05 3.2-3.05s3.2 1.1 3.2 3.05" />
                <path d="M9.0 13.9L7.7 15.1L9.0 16.3" />
                <path d="M12.0 13.9L13.3 15.1L12.0 16.3" />
                <path d="M11.3 13.5L9.7 16.7" />
            </svg>
        );
    }
    if (value === "__repotest") {
        // A checkmark inside a magnifying glass (a /repo-test report - tests pass).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Repo test">
                <circle cx="10.5" cy="10.5" r="9" />
                <line x1="21" y1="21" x2="17" y2="17" />
                <path d="M6.7 10.9l2.6 2.6 5-5.4" />
            </svg>
        );
    }
    if (value === "__storageaudit") {
        // A Mac Mini with a disk/database on top (a /storage-audit report - M4 storage).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Storage audit">
                <path d="M4.3 15.4a2.1 2.1 0 0 1 2.1-2.1h11.2a2.1 2.1 0 0 1 2.1 2.1v1.3a2.1 2.1 0 0 1-2.1 2.1H6.4a2.1 2.1 0 0 1-2.1-2.1z" />
                <path d="M6.5 13.3q5.5-1.4 11 0" />
                <circle cx="17" cy="16.4" r=".5" />
                <ellipse cx="11" cy="6.7" rx="3.3" ry="1.1" />
                <path d="M7.7 6.7V11c0 .6 1.48 1.1 3.3 1.1s3.3-.5 3.3-1.1V6.7" />
                <path d="M7.7 8.2c0 .6 1.48 1.1 3.3 1.1s3.3-.5 3.3-1.1" />
                <path d="M7.7 9.6c0 .6 1.48 1.1 3.3 1.1s3.3-.5 3.3-1.1" />
            </svg>
        );
    }
    if (value === "__resourceaudit") {
        // A Mac Mini with a CPU chip + bar chart on top (a /resource-audit report - M4 load).
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-label="Resource audit">
                <path d="M4.3 15.4a2.1 2.1 0 0 1 2.1-2.1h11.2a2.1 2.1 0 0 1 2.1 2.1v1.3a2.1 2.1 0 0 1-2.1 2.1H6.4a2.1 2.1 0 0 1-2.1-2.1z" />
                <path d="M6.5 13.3q5.5-1.4 11 0" />
                <circle cx="17" cy="16.4" r=".5" />
                <rect x="5.5" y="6" width="4.4" height="4.4" rx=".7" />
                <rect x="6.9" y="7.4" width="1.6" height="1.6" rx=".25" />
                <path d="M6.5 6v-.8M8.9 6v-.8M6.5 10.4v.8M8.9 10.4v.8" />
                <path d="M12.4 10.6V8.4M14 10.6V6M15.6 10.6V7.6" />
            </svg>
        );
    }
    if (value.startsWith("__app:")) {
        // App-source icon (e.g. "__app:pixel") - the posting app's real logo, in full
        // color (no white silhouette filter) so audits/reports are distinct at a glance.
        const src = appIconForKey(value.slice(6));
        return src
            ? <img src={src} alt={folderName} className={className} style={{ objectFit: "contain", borderRadius: "22%" }} />
            : <span className="font-black">{folderName.charAt(0).toUpperCase()}</span>;
    }
    if (value.startsWith("__hero:")) {
        const key = value.slice(7);
        const Ic = HERO_ICON_MAP[key];
        return Ic ? <Ic className={className} /> : <span className="font-black">{folderName.charAt(0).toUpperCase()}</span>;
    }
    if (value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://")) {
        return <img src={value} alt={folderName} className={className} style={{ objectFit: "contain", borderRadius: "22%", filter: "brightness(0) invert(1)" }} />;
    }
    return <span className="font-black">{folderName.charAt(0).toUpperCase()}</span>;
}
