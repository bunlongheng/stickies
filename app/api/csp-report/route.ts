/**
 * CSP violation sink.
 *
 * The Content-Security-Policy-Report-Only header in next.config.ts is only useful
 * if something receives the reports - a report-only policy with no endpoint is
 * inert by spec, which is exactly what Safari warns about in the console. This is
 * that endpoint: it accepts both payload shapes browsers send and always answers
 * 204, so a violation report can never surface as an error to the user.
 *
 * Reports are logged in development only. Wire a real sink here before promoting
 * the policy to an enforcing Content-Security-Policy header.
 */
import { NextResponse } from "next/server";

const NO_CONTENT = () => new NextResponse(null, { status: 204 });

export async function POST(req: Request) {
    if (process.env.NODE_ENV !== "development") return NO_CONTENT();
    try {
        // Legacy browsers send {"csp-report": {...}} as application/csp-report;
        // the Reporting API sends an array of {type, body} as application/reports+json.
        const body = await req.json();
        const reports = Array.isArray(body) ? body : [body];
        for (const r of reports) {
            const v = r?.body ?? r?.["csp-report"] ?? r;
            const directive = v?.effectiveDirective ?? v?.["effective-directive"] ?? "?";
            const blocked = v?.blockedURL ?? v?.["blocked-uri"] ?? "?";
            console.warn(`[csp] ${directive} blocked ${blocked}`);
        }
    } catch {
        // A malformed report is not worth failing on - the endpoint must stay quiet.
    }
    return NO_CONTENT();
}
