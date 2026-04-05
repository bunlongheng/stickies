/**
 * Unit tests: welcome-email.ts
 * Tags: unit, email
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { sendWelcomeEmail } from "@/lib/welcome-email";

beforeEach(() => { mockFetch.mockReset(); });

describe("sendWelcomeEmail", () => {
    it("skips when RESEND_API_KEY is not set", async () => {
        const origKey = process.env.RESEND_API_KEY;
        delete process.env.RESEND_API_KEY;
        await sendWelcomeEmail("test@example.com");
        expect(mockFetch).not.toHaveBeenCalled();
        if (origKey) process.env.RESEND_API_KEY = origKey;
    });

    it("sends email when RESEND_API_KEY is set", async () => {
        process.env.RESEND_API_KEY = "re_test_key";
        mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: "msg-1" }) });
        await sendWelcomeEmail("test@example.com", "John Doe");
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, opts] = mockFetch.mock.calls[0];
        expect(url).toContain("resend.com");
        expect(opts.method).toBe("POST");
        const body = JSON.parse(opts.body);
        expect(body.to).toContain("test@example.com");
    });

    it("uses email prefix as name when no name provided", async () => {
        process.env.RESEND_API_KEY = "re_test_key";
        mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
        await sendWelcomeEmail("john@example.com");
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.html).toContain("john");
    });

    it("does not throw on fetch error", async () => {
        process.env.RESEND_API_KEY = "re_test_key";
        mockFetch.mockRejectedValue(new Error("Network error"));
        // Should not throw
        await expect(sendWelcomeEmail("test@example.com")).resolves.toBeUndefined();
    });
});
