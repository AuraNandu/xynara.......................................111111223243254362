# XYNARA REAL v3 — NO DUMMY, NO PREVIEW

REAL login (hashed password in D1), REAL messages (D1), REAL calls (WebRTC + Durable Objects signaling).

## DELETE OLD DUMMY FIRST
1. In GitHub repo `xynara`, DELETE all old files (old index.html, src/, vite.config.ts, build.js)
2. Upload ALL files from this ZIP
3. Your repo must now have: public/, worker/, migrations/, wrangler.toml, package.json

## DEPLOY - ONE COMMAND (Worker + Frontend together)
```bash
npm install
npx wrangler d1 create xynara-db
# copy database_id into wrangler.toml
npm run db:migrate
npx wrangler deploy
```
You get: https://xynara.<your-subdomain>.workers.dev — THIS IS REAL.

Do NOT use Cloudflare Pages for this version. Use Workers (wrangler deploy). Pages was the dummy path.

## Test REAL
- Open link on 2 phones / 2 browsers
- Sign up as nandu on phone 1, as aria on phone 2 (different usernames, real accounts)
- Send message on phone 1 → appears on phone 2 (real DB)
- Call: phone 1 calls aria → phone 2 gets REAL incoming call → Accept → REAL video (not demo)
- Admin: password AuraNandu_2012 → see REAL users, REAL chats, ban works

## Admin
Password: AuraNandu_2012 — stored in wrangler.toml [vars] and checked SERVER-side in worker. Change it in Cloudflare Dashboard > Workers > xynara > Settings > Variables after deploy.
