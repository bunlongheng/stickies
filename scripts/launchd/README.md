# Running the hub as a macOS LaunchAgent

`com.bheng.stickies.plist` keeps `scripts/hub-serve.mjs` running, which serves the
**production** build on port 4444 with keyless LAN access for the owner. It is a
template: the paths are placeholders so the file carries no machine-specific layout.

Install it:

```bash
mkdir -p ~/Library/LaunchAgents
sed -e "s|__STICKIES_DIR__|$PWD|g" \
    -e "s|__NODE_BIN__|$(command -v node)|g" \
    -e "s|__NODE_BIN_DIR__|$(dirname "$(command -v node)")|g" \
    scripts/launchd/com.bheng.stickies.plist \
    > ~/Library/LaunchAgents/com.bheng.stickies.plist

npm run build
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.bheng.stickies.plist
```

Rebuild and restart after a merge:

```bash
npm run build
launchctl kickstart -k "gui/$(id -u)/com.bheng.stickies"
```

Logs go to `/tmp/stickies-hub.log`. `npm run dev` takes port 4444 over while you
work and the agent reclaims it when dev exits, so never point the agent at
`npm run dev`.
