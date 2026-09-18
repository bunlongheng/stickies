import { describe, it, expect } from "vitest";
import {
    hashLockPassword,
    verifyLockPassword,
    signUnlockCookie,
    verifyUnlockCookie,
} from "@/lib/lock-password";

describe("hashLockPassword / verifyLockPassword", () => {
    it("verifies a correct password against its own hash", async () => {
        const stored = await hashLockPassword("hunter2");
        expect(await verifyLockPassword("hunter2", stored)).toBe(true);
    });

    it("rejects a wrong password", async () => {
        const stored = await hashLockPassword("hunter2");
        expect(await verifyLockPassword("wrong", stored)).toBe(false);
    });

    it("produces a salted salt$hash shape with a fresh salt each call", async () => {
        const a = await hashLockPassword("same");
        const b = await hashLockPassword("same");
        expect(a).toMatch(/^[0-9a-f]+\$[0-9a-f]+$/);
        expect(a).not.toBe(b); // random salt -> different digests
        expect(await verifyLockPassword("same", a)).toBe(true);
        expect(await verifyLockPassword("same", b)).toBe(true);
    });

    it("returns false for null / malformed stored values", async () => {
        expect(await verifyLockPassword("x", null)).toBe(false);
        expect(await verifyLockPassword("x", "no-delimiter")).toBe(false);
        expect(await verifyLockPassword("x", "$")).toBe(false);
    });
});

describe("signUnlockCookie / verifyUnlockCookie", () => {
    it("round-trips a token for the same note + hash", () => {
        const token = signUnlockCookie("note-1", "hashA");
        expect(verifyUnlockCookie("note-1", "hashA", token)).toBe(true);
    });

    it("is bound to the note id", () => {
        const token = signUnlockCookie("note-1", "hashA");
        expect(verifyUnlockCookie("note-2", "hashA", token)).toBe(false);
    });

    it("is invalidated when the password hash rotates", () => {
        const token = signUnlockCookie("note-1", "hashA");
        expect(verifyUnlockCookie("note-1", "hashB", token)).toBe(false);
    });

    it("returns false for a missing or malformed cookie", () => {
        expect(verifyUnlockCookie("note-1", "hashA", undefined)).toBe(false);
        expect(verifyUnlockCookie("note-1", "hashA", "deadbeef")).toBe(false);
    });
});
