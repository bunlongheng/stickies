// One-time script to get a Google OAuth2 refresh token for Drive access
// Run: node scripts/gdrive-auth.mjs

import { createServer } from "http";
import { google } from "googleapis";

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:9876/callback";

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/drive"],
});

console.log("\n✅ Open this URL in your browser:\n");
console.log(authUrl);
console.log("\nWaiting for callback on http://localhost:9876 ...\n");

const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost:9876");
    const code = url.searchParams.get("code");
    if (!code) { res.end("No code"); return; }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        res.end("<h1>Success! Check your terminal.</h1>");
        console.log("\n🎉 REFRESH TOKEN:\n");
        console.log(tokens.refresh_token);
        console.log("\nAdd to .env.local:\n");
        console.log(`GOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}`);
        console.log(`GOOGLE_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}`);
        console.log(`GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
    } catch (err) {
        res.end("Error: " + err.message);
        console.error(err);
    } finally {
        server.close();
    }
});

server.listen(9876);
