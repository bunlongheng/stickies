// Canonical shapes for a note/folder row as returned by the stickies API. The
// index signature keeps them permissive (rows carry many optional columns and
// computed fields) while giving the hot, always-present fields real types.

export interface NoteRow {
    [key: string]: unknown;
    id: string;
    title: string;
    content?: string;
    folder_name: string;
    folder_color?: string;
    folder_id?: string | null;
    parent_folder_name?: string | null;
    is_folder: boolean;
    type?: string | null;
    order?: number;
    icon?: string | null;
    list_mode?: boolean;
    locked?: boolean;
    frozen?: boolean;
    is_public?: boolean;
    trashed_at?: string | null;
    created_by_key?: string | null;
    created_by_machine?: string | null;
    created_at: string;
    updated_at: string;
}

export interface FolderRow {
    [key: string]: unknown;
    id: string;
    folder_name: string;
    folder_color?: string;
    parent_folder_name?: string | null;
    is_folder: true;
    order?: number;
    updated_at: string;
}
