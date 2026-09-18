// localStorage keys for the app page's client-persisted UI state (view mode, theme,
// pinned folders, per-note format flags, folder colors/icons, draft backup, caches).
// Extracted from app/(app)/page.tsx to de-clutter the God component's module scope.
export const SHOW_FILE_ICONS_KEY = "stickies:show-file-icons:v1";
export const PINNED_KEY = "stickies_pinned_ids";
export const PINNED_FOLDERS_KEY = "stickies:pinned-folders:v1";
export const VIEW_STATE_KEY = "stickies:last-view:v1";
export const ACTIVE_DRAFT_KEY = "stickies:active-draft:v1";
export const FOLDER_COLOR_KEY = "stickies:folder-colors:v2";
export const FOLDER_ICON_KEY = "stickies:folder-icons:v1";
export const NOTE_ICON_KEY = "stickies:note-icons:v1";
export const MAIN_LIST_MODE_KEY = "stickies:main-list-mode:v1";
export const APP_THEME_KEY = "stickies:app-theme:v1";
export const LIST_MODE_KEY = "stickies:list-mode-notes:v1";
export const HTML_MODE_KEY = "stickies:html-mode-notes:v1";
export const DEFAULT_FOLDER_KEY = "stickies:default-folder:v1";
export const LAST_FOLDER_KEY = "stickies:last-folder:v1"; // persists last active folder across sessions
export const DB_CACHE_KEY = "stickies:db-cache:v2";
export const COUNTS_CACHE_KEY = "stickies:counts-cache:v2";
export const DEV_MODE_KEY = "stickies:dev-mode:v1";
