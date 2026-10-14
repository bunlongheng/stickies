/**
 * Unit: lib/lock-backdrop.tsx - the note's real text rendered, shrunk and
 * blurred on the server for the passcode gate backdrop.
 */
import { describe, it, expect } from "vitest";
import { lockBackdropImage } from "@/lib/lock-backdrop";

const CONTENT = "<h1>Quarterly plan</h1><p>TOPSECRETBODY is the word that must never ship.</p><p>Second line of the note.</p>";

describe("lockBackdropImage", () => {
    it("returns a small JPEG data URI that holds none of the note's words", async () => {
        const uri = await lockBackdropImage("n1", "Plan", CONTENT, "#3b82f6");
        expect(uri).toMatch(/^data:image\/jpeg;base64,/);
        const bytes = Buffer.from(uri!.split(",")[1], "base64");
        expect(bytes.length).toBeGreaterThan(500);
        expect(bytes.length).toBeLessThan(40_000);
        expect(bytes.toString("latin1")).not.toContain("TOPSECRETBODY");
        // 320px wide: the SOF0 marker carries height then width as big-endian u16.
        const sof = bytes.indexOf(Buffer.from([0xff, 0xc0]));
        expect(bytes.readUInt16BE(sof + 7)).toBe(320);
    }, 20_000);

    it("is null for an empty note and cached for a repeat", async () => {
        expect(await lockBackdropImage("n2", "Empty", "", null)).toBeNull();
        const a = await lockBackdropImage("n3", "Plan", CONTENT, null);
        const b = await lockBackdropImage("n3", "Plan", CONTENT, null);
        expect(a).toBe(b);
    }, 20_000);
});
