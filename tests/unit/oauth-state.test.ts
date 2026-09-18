/**
 * Unit: gdrive OAuth CSRF state helper.
 */
import { describe, it, expect } from "vitest";
import { newOAuthState, verifyOAuthState } from "@/app/api/stickies/gdrive/_oauth-state";

describe("newOAuthState", () => {
    it("returns a 64-char hex string", () => {
        expect(newOAuthState()).toMatch(/^[a-f0-9]{64}$/);
    });
    it("is unguessable - two mints never collide", () => {
        expect(newOAuthState()).not.toBe(newOAuthState());
    });
});

describe("verifyOAuthState", () => {
    it("accepts an exact match", () => {
        const s = newOAuthState();
        expect(verifyOAuthState(s, s)).toBe(true);
    });
    it("rejects a mismatch of equal length", () => {
        expect(verifyOAuthState("a".repeat(64), "b".repeat(64))).toBe(false);
    });
    it("rejects different lengths without throwing", () => {
        expect(verifyOAuthState("abc", "abcd")).toBe(false);
    });
    it("fails closed on missing/empty input", () => {
        expect(verifyOAuthState(null, "x")).toBe(false);
        expect(verifyOAuthState("x", undefined)).toBe(false);
        expect(verifyOAuthState("", "")).toBe(false);
    });
});
