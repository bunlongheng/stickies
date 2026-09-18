import { describe, it, expect, afterEach } from "vitest";
import { sslConfig } from "@/lib/db";

const CA = "-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----";

describe("sslConfig", () => {
    afterEach(() => { delete process.env.DATABASE_CA_CERT; });

    it("returns false for local (non-remote) connections", () => {
        expect(sslConfig(false)).toBe(false);
    });

    it("verifies the cert when DATABASE_CA_CERT is a raw PEM", () => {
        process.env.DATABASE_CA_CERT = CA;
        expect(sslConfig(true)).toEqual({ ca: CA, rejectUnauthorized: true });
    });

    it("decodes a base64 DATABASE_CA_CERT and verifies", () => {
        process.env.DATABASE_CA_CERT = Buffer.from(CA).toString("base64");
        expect(sslConfig(true)).toEqual({ ca: CA, rejectUnauthorized: true });
    });

    it("falls back to unverified (but working) TLS when no CA is supplied", () => {
        expect(sslConfig(true)).toEqual({ rejectUnauthorized: false });
    });
});
