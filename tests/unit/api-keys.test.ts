/**
 * Unit tests: lib/api-keys — key minting + hashing.
 *
 * Validates:
 * - generateApiKey format (sk_ prefix, length, char set) + uniqueness across calls
 * - hashApiKey determinism + differs per input
 * - prefix is the first 12 chars of the plaintext
 *
 * Tags: unit, api-keys, crypto
 * Priority: high
 */
import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { generateApiKey, hashApiKey } from "@/lib/api-keys";

describe("generateApiKey", () => {
    it("plaintext starts with sk_", () => {
        expect(generateApiKey().plaintext.startsWith("sk_")).toBe(true);
    });

    it("plaintext is sk_ + 32 base62 chars (35 total)", () => {
        const { plaintext } = generateApiKey();
        expect(plaintext).toHaveLength(35);
        // After the sk_ prefix, every char is base62
        expect(plaintext.slice(3)).toMatch(/^[0-9A-Za-z]{32}$/);
    });

    it("prefix is the first 12 chars of the plaintext", () => {
        const { plaintext, prefix } = generateApiKey();
        expect(prefix).toHaveLength(12);
        expect(prefix).toBe(plaintext.slice(0, 12));
        expect(prefix.startsWith("sk_")).toBe(true);
    });

    it("hash matches hashApiKey(plaintext)", () => {
        const { plaintext, hash } = generateApiKey();
        expect(hash).toBe(hashApiKey(plaintext));
    });

    it("produces unique plaintexts and hashes across calls", () => {
        const keys = Array.from({ length: 200 }, () => generateApiKey());
        expect(new Set(keys.map(k => k.plaintext)).size).toBe(200);
        expect(new Set(keys.map(k => k.hash)).size).toBe(200);
    });
});

describe("hashApiKey", () => {
    it("is deterministic for the same input", () => {
        expect(hashApiKey("sk_hello")).toBe(hashApiKey("sk_hello"));
    });

    it("differs for different inputs", () => {
        expect(hashApiKey("sk_a")).not.toBe(hashApiKey("sk_b"));
    });

    it("returns a 64-char sha-256 hex digest", () => {
        const h = hashApiKey("sk_anything");
        expect(h).toMatch(/^[0-9a-f]{64}$/);
        expect(h).toBe(crypto.createHash("sha256").update("sk_anything", "utf8").digest("hex"));
    });
});
