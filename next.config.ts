import type { NextConfig } from "next";

// Content-Security-Policy shipped in REPORT-ONLY mode first: it never blocks, it
// only reports violations, so we can watch the report stream and confirm nothing
// legit breaks (Pusher websockets, Google OAuth, inline styles) before promoting it
// to an enforcing Content-Security-Policy header.
//
// A report-only policy with no reporting endpoint is inert by spec - it collects
// nothing and protects nothing - so the policy names a report group and the
// Reporting-Endpoints header below points that group at /api/csp-report.
// `frame-ancestors` is deliberately NOT here: it is ignored in report-only mode,
// and X-Frame-Options: SAMEORIGIN already carries clickjacking protection.
const CSP_REPORT_GROUP = "csp-endpoint";
const CSP_REPORT_PATH = "/api/csp-report";
const CSP_REPORT_ONLY = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.pusher.com wss://*.pusher.com https://*.pusherapp.com https://*.googleapis.com https://accounts.google.com https://api.resend.com https://api.anthropic.com",
    "frame-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
].join("; ");

// Baseline security headers on every response.
const SECURITY_HEADERS = [
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
    { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
    { key: "Reporting-Endpoints", value: `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"` },
];

const nextConfig: NextConfig = {
    devIndicators: false,
    async headers() {
        return [{ source: "/:path*", headers: SECURITY_HEADERS }];
    },
};

export default nextConfig;
