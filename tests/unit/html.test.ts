import { describe, it, expect } from "vitest";
import { wrapHtmlWithTheme } from "@/lib/html";

describe("wrapHtmlWithTheme", () => {
    it("uses dark or light surface colors per the theme flag", () => {
        expect(wrapHtmlWithTheme("<p>hi</p>", true)).toContain("#1a1a1a");
        expect(wrapHtmlWithTheme("<p>hi</p>", true)).toContain("#e8e8e8");
        const light = wrapHtmlWithTheme("<p>hi</p>", false);
        expect(light).toContain("#ffffff");
        expect(light).toContain("#0066cc"); // light link color
    });

    it("injects theme defaults into an existing <head> for a full document", () => {
        const doc = "<!DOCTYPE html><html><head><title>t</title></head><body>x</body></html>";
        const out = wrapHtmlWithTheme(doc, false);
        // theme <style> lands right after <head> opens, before author content
        expect(out.indexOf("<style>")).toBeLessThan(out.indexOf("<title>"));
        // enforce style is appended just before </body>
        expect(out).toContain("!important}</style></body>");
    });

    it("adds a <head> when a full <html> document has none", () => {
        const out = wrapHtmlWithTheme("<html><body>x</body></html>", false);
        expect(out).toContain("<head>");
        expect(out).toContain("<style>");
    });

    it("wraps a bare fragment in a full document with a trailing enforce style", () => {
        const out = wrapHtmlWithTheme("<div>fragment</div>", true);
        expect(out.startsWith("<!DOCTYPE html><html><head>")).toBe(true);
        expect(out).toContain("<div>fragment</div>");
        expect(out).toContain("!important}</style></body></html>");
    });

    it("extracts inline <script> blocks out of a fragment body", () => {
        const out = wrapHtmlWithTheme("<div>x</div><script>alert(1)</script>", false);
        // script is moved after the body content, not left inline in place
        expect(out.indexOf("<div>x</div>")).toBeLessThan(out.indexOf("<script>alert(1)</script>"));
    });
});
