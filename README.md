Raider Portal

Hosting
- Code lives on GitHub. Vercel builds and runs it from the main branch.
- Vercel: import the repo, framework "Other", no build command. public/ is served, api/ becomes serverless functions.

Environment variables (Vercel > Settings > Environment Variables)
- ADMIN_PASSWORD: the admin login password. Use a long passphrase.
- SESSION_SECRET: random string, 32+ characters.
- GITHUB_TOKEN: fine-grained token limited to this one repo with Contents: read and write.
- GITHUB_REPO: owner/name, like yourname/raider-portal.
- GITHUB_BRANCH (optional, default main) and CONFIG_PATH (optional, default config/site.json).

Admin
- Open /admin on your Vercel domain. Settings save to config/site.json in GitHub and reach visitors in about 15 seconds without a redeploy.
- Every save is a commit, so History in the admin can roll anything back.
- API checks in the admin verify the environment, GitHub access, the settings endpoint, the live site, scripts and security headers, and can check any links.
- Add a Vercel Firewall rate limit rule for /api/admin/login.

Editing the site
- Edit src/app.html, then run: node tools/build.js
- The build repacks the site into public/ with new chunk names, SRI hashes and key, and regenerates public/admin.html and api/_schema.json.
- To add a new setting, add it to the CONFIG object in src/app.html and to tools/schema.json, then rebuild.
- Commit the result.

Admin settings (100 added)
- Open hours: lock or soft-warn outside set hours and days, or block only apps (8).
- Welcome and agreement: welcome dialog and an acceptable-use agreement students must accept, with optional re-ask (10).
- Second notice: a second message bar with style, schedule, link and dismiss (8).
- Branding: emoji, accent colors, favicon, tab title suffix, school badge, hero line, footer, support email (12).
- Time limits and breaks: break and eye-rest reminders, session limit break screen, auto-refresh for open tabs (9).
- Accessibility defaults: text scale, reduce motion, calm mode, contrast, font, spacing, grayscale, dim and more for everyone (12).
- App filtering: blocked keywords, allow-list, blocked search words, warn-before-open apps, grid columns, pin and recent limits, custom messages (11).
- Tools page, Tabs and headings, Hide page parts: show only or reorder tools, tab order, phone-only hiding, rename headings, hide small page elements (21).
- Testing and lock extras: tab-switch notice, full screen button, watermark, hide search, lock screen tint and clock, block copy/paste in typing boxes, confirm before closing (9).
- Settings are defined in tools/schema.json and enforced in src/app.html (CONFIG defaults plus the block marked "Admin feature pack"). After changing either, run: node tools/build.js
- Printing, dragging, and copy/paste outside typing boxes are already blocked by the built-in protections, so there are no settings for those.
- Tab-switch notices stay on the student's device; nothing is reported to the admin.
