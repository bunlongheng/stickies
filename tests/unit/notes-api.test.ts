/**
 * Unit: lib/notes-api - thin fetch client over /api/stickies.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { notesApi } from "@/lib/notes-api";

const okJson = (body: unknown = {}) => ({ ok: true, status: 200, json: async () => body }) as Response;
const errJson = (status: number, error = "boom") =>
    ({ ok: false, status, json: async () => ({ error }) }) as Response;

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch");
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue(okJson());
});

describe("notesApi", () => {
    it("update PATCHes the note and returns the parsed body", async () => {
        fetchSpy.mockResolvedValueOnce(okJson({ note: { id: "n1", title: "x" } }));
        const r = await notesApi.update("n1", { title: "x" });
        expect(r.note.id).toBe("n1");
        const [url, opts] = fetchSpy.mock.calls[0];
        expect(url).toBe("/api/stickies");
        expect((opts as RequestInit).method).toBe("PATCH");
        expect(JSON.parse((opts as RequestInit).body as string)).toMatchObject({ id: "n1", title: "x" });
    });

    it("update swallows a 423 Locked and reports the note as locked", async () => {
        fetchSpy.mockResolvedValueOnce(errJson(423));
        const r = await notesApi.update("n1", { title: "x" });
        expect(r).toEqual({ note: { id: "n1", locked: true } });
    });

    it("update throws the server error on a non-ok, non-423 response", async () => {
        fetchSpy.mockResolvedValueOnce(errJson(500, "db down"));
        await expect(notesApi.update("n1", {})).rejects.toThrow(/db down/);
    });

    it("insert POSTs to the raw endpoint", async () => {
        fetchSpy.mockResolvedValueOnce(okJson({ note: { id: "n2" } }));
        const r = await notesApi.insert({ title: "hi" });
        expect(r.note.id).toBe("n2");
        expect(fetchSpy.mock.calls[0][0]).toBe("/api/stickies?raw=1");
    });

    it("delete issues a DELETE with the id query param", async () => {
        await notesApi.delete("n3");
        const [url, opts] = fetchSpy.mock.calls[0];
        expect(url).toBe("/api/stickies?id=n3");
        expect((opts as RequestInit).method).toBe("DELETE");
    });

    it("bulkUpdate returns quietly on 423", async () => {
        fetchSpy.mockResolvedValueOnce(errJson(423));
        await expect(notesApi.bulkUpdate([{ id: "n1" }])).resolves.toBeUndefined();
    });

    it("renameFolder sends the rename_folder payload", async () => {
        await notesApi.renameFolder("A", "B");
        expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string))
            .toEqual({ rename_folder: { from: "A", to: "B" } });
    });

    it("deleteByFolder throws on failure", async () => {
        fetchSpy.mockResolvedValueOnce(errJson(500, "nope"));
        await expect(notesApi.deleteByFolder("F")).rejects.toThrow(/nope/);
    });

    it("insert throws on a non-ok response", async () => {
        fetchSpy.mockResolvedValueOnce(errJson(500, "insert boom"));
        await expect(notesApi.insert({})).rejects.toThrow(/insert boom/);
    });

    it("delete throws on a non-ok response", async () => {
        fetchSpy.mockResolvedValueOnce(errJson(500, "del boom"));
        await expect(notesApi.delete("n1")).rejects.toThrow(/del boom/);
    });

    it("bulkUpdate throws on a non-ok, non-423 response", async () => {
        fetchSpy.mockResolvedValueOnce(errJson(500, "bulk boom"));
        await expect(notesApi.bulkUpdate([{ id: "n1" }])).rejects.toThrow(/bulk boom/);
    });

    it("renameFolder throws on a non-ok response", async () => {
        fetchSpy.mockResolvedValueOnce(errJson(500, "rename boom"));
        await expect(notesApi.renameFolder("A", "B")).rejects.toThrow(/rename boom/);
    });

    it("falls back to a generic message when the error body has no error field", async () => {
        fetchSpy.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) } as Response);
        await expect(notesApi.update("n1", {})).rejects.toThrow(/update failed/);
    });
});
