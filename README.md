# 🤖 Website Monitor — Powered by Claude AI

Automated website monitor for **up to 20 sites** — runs every morning & afternoon on GitHub Actions, with AI-written reports sent to your **Telegram**.

---

## ⚡ Setup Guide

### Step 1 — Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the **Bot Token** (looks like `7123456789:AAF...`)
4. Send any message to your new bot to activate it

### Step 2 — Get Your Chat ID

1. Search for **@userinfobot** on Telegram
2. Start it — it will reply with your **Chat ID** (a number like `123456789`)
3. Save this number

### Step 3 — Create GitHub Repository

Create a new repo (e.g. `website-monitor`) and push all these files, keeping the folder structure including `.github/workflows/`.

### Step 4 — Add GitHub Secrets

Go to repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `TELEGRAM_BOT_TOKEN` | Token from @BotFather |
| `TELEGRAM_CHAT_ID` | Your chat ID from @userinfobot |
| `WEBSITES` | JSON array of your sites (see below) |

### Step 5 — Configure Your Websites

Set the `WEBSITES` secret as a JSON array. Example for up to 20 sites:

```json
[
  "https://mywebsite.com",
  "https://api.mywebsite.com",
  "https://blog.mywebsite.com",
  "https://shop.mywebsite.com",
  "https://admin.mywebsite.com"
]
```

### Step 6 — Test It

Go to **Actions** tab → **Website Status Monitor** → **Run workflow** → click **Run workflow**.

Check your Telegram — you should receive a report within ~30 seconds!

---

## ⏰ Schedule

| Check | WIB | UTC (cron) |
|---|---|---|
| 🌅 Morning | 7:00 AM | `0 0 * * *` |
| ☀️ Afternoon | 2:00 PM | `0 7 * * *` |

To change times, edit the `cron` lines in `.github/workflows/monitor.yml`.

---

## 📱 What the Telegram Message Looks Like

```
✅ *All Systems Clear — Morning Check*

All 8 sites are up and running.

✅ mywebsite.com — 142ms
✅ api.mywebsite.com — 89ms
✅ blog.mywebsite.com — 201ms
...

Avg response time: 156ms
Checked at: 07:00 WIB · Powered by Claude AI
```

If a site is down:
```
🚨 *Critical — 2 Sites Down*

❌ api.mywebsite.com — Connection refused
❌ shop.mywebsite.com — Timeout (10s)
✅ mywebsite.com — 142ms

⚠️ Action Needed: Check your API server and shop...
```

---

## 💰 Cost

| Service | Cost |
|---|---|
| GitHub Actions | Free (public repo) |
| Claude API | ~$0.002 per report |
| Telegram | Free |

**Total: ~$0.12/month** for twice-daily checks on up to 20 sites.

---

## 🛠 Customization

- **Add sites:** Edit the `WEBSITES` secret (up to 20 URLs)
- **Change schedule:** Edit cron in `.github/workflows/monitor.yml`
- **Change report style:** Edit the prompt in `monitor.js → generateReport()`
- **Monitor a private group:** Add the bot to a group and use the group's chat ID
