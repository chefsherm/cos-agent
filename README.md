# CoS Agent — Chief of Staff for Sherm

AI-powered Chief of Staff. Morning brief via email at 8am ET (Mon–Fri). Full dashboard for ventures, decisions, and chat.

## Deploy in 4 steps

### Step 2 — Create GitHub repo and push
```bash
cd cos-agent
git init
git add .
git commit -m "init: CoS agent"
git remote add origin https://github.com/chefsherm/cos-agent.git
git push -u origin main
```

### Step 3 — Deploy to Vercel
1. Go to vercel.com → Add New Project
2. Import the `cos-agent` repo
3. Framework: Next.js (auto-detected)
4. Click Deploy

### Step 4 — Get Resend API key
1. Go to resend.com → Sign up (free)
2. Go to API Keys → Create API Key
3. Copy the key

### Step 5 — Add environment variables in Vercel
In your Vercel project → Settings → Environment Variables, add:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic key |
| `RESEND_API_KEY` | From resend.com |
| `BRIEF_EMAIL` | Email to receive briefs |
| `CRON_SECRET` | Any random string (e.g. `cos-secret-2026`) |

Then: Vercel → Deployments → Redeploy (to pick up env vars).

## Cron schedule
`vercel.json` is set to `0 12 * * 1-5` — 8am ET (Mon–Fri).
Adjust for EST winter: change to `0 13 * * 1-5`.

## Local dev
```bash
npm install
cp .env.example .env.local
# fill in .env.local
npm run dev
```
