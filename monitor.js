import fetch from "node-fetch";

const WEBSITES = JSON.parse(process.env.WEBSITES || "[]");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const REPORT_TIME = process.env.REPORT_TIME || "morning";
const MODE = process.env.MODE || "report"; // "report" or "alert"

// ─── CHECK WEBSITE ───────────────────────────────────────────────────────────
async function checkWebsite(url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "WebsiteMonitor/1.0" },
    });
    clearTimeout(timeout);
    return { url, status: res.status, ok: res.ok, responseTime: Date.now() - start, error: null };
  } catch (err) {
    return { url, status: null, ok: false, responseTime: Date.now() - start, error: err.message };
  }
}

async function checkAll() {
  const results = [];
  for (let i = 0; i < WEBSITES.length; i += 10) {
    const batch = WEBSITES.slice(i, i + 10);
    results.push(...await Promise.all(batch.map(checkWebsite)));
  }
  return results;
}

// ─── SEND TELEGRAM ───────────────────────────────────────────────────────────
async function sendTelegram(message) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram error: ${JSON.stringify(data)}`);
  console.log("Telegram message sent.");
}

// ─── MODE 1: SCHEDULED REPORT (calls Claude) ─────────────────────────────────
async function runReport(results) {
  const downCount = results.filter(r => !r.ok).length;
  const upSites = results.filter(r => r.ok);
  const avgResponse = upSites.length
    ? Math.round(upSites.reduce((a, r) => a + r.responseTime, 0) / upSites.length)
    : 0;

  const summary = results.map(r =>
    `${r.url}: ${r.ok ? "UP" : "DOWN"} | HTTP ${r.status || "N/A"} | ${r.responseTime}ms${r.error ? ` | ${r.error}` : ""}`
  ).join("\n");

  const prompt = `You are a website monitoring assistant. Generate a concise Telegram status report for the ${REPORT_TIME} check.

Check results (${results.length} sites):
${summary}

Stats: ${upSites.length} UP, ${downCount} DOWN, avg response: ${avgResponse}ms

Write a Telegram message using these rules:
- Use Markdown formatting (bold with *text*, code with \`text\`)
- Start with a status emoji headline: ✅ All Clear / ⚠️ Issues Detected / 🚨 Critical
- Brief summary line
- List ALL sites, each on its own line: ✅ for UP (domain + response time), ❌ for DOWN (domain + error)
- If any DOWN: add a short "Action needed" section
- End with timestamp line
- Keep it scannable. DO NOT use HTML, only Telegram Markdown.
Return ONLY the message text.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(`Claude API error: ${JSON.stringify(data)}`);

  await sendTelegram(data.content[0].text);
}

// ─── MODE 2: ALERT ONLY (no Claude, no tokens) ───────────────────────────────
async function runAlert(results) {
  // Load previous state from env (passed as JSON by the workflow)
  let prevState = {};
  try {
    prevState = JSON.parse(process.env.PREV_STATE || "{}");
  } catch (_) {}

  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  const messages = [];

  for (const r of results) {
    const wasDown = prevState[r.url] === "down";
    const isDown = !r.ok;

    if (isDown && !wasDown) {
      // Newly down — alert!
      messages.push(
        `🚨 *SITE DOWN*\n\`${r.url}\`\nStatus: ${r.status || "No response"}\nError: ${r.error || "HTTP " + r.status}\n🕐 ${now} WIB`
      );
    } else if (!isDown && wasDown) {
      // Just recovered — notify!
      messages.push(
        `✅ *SITE RECOVERED*\n\`${r.url}\`\nResponse: ${r.responseTime}ms\n🕐 ${now} WIB`
      );
    }
    // If still up or still down — silence. No message.
  }

  // Send each alert as a separate message for clarity
  for (const msg of messages) {
    await sendTelegram(msg);
  }

  if (messages.length === 0) {
    console.log("All sites same as before. No alerts sent.");
  }

  // Output new state for the workflow to cache
  const newState = {};
  for (const r of results) {
    newState[r.url] = r.ok ? "up" : "down";
  }
  // Write state to a file so the next run can read it
  const fs = await import("fs");
  fs.writeFileSync("state.json", JSON.stringify(newState));
  console.log("State saved:", newState);
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  if (!WEBSITES.length) { console.error("No WEBSITES configured."); process.exit(1); }

  try {
    console.log(`Running in ${MODE} mode — checking ${WEBSITES.length} sites...`);
    const results = await checkAll();
    console.log("Check complete.");

    if (MODE === "alert") {
      await runAlert(results);
    } else {
      await runReport(results);
    }

    console.log("Done!");
  } catch (err) {
    console.error("Monitor failed:", err);
    try {
      await sendTelegram(`🔴 *Monitor Error (${MODE} mode)*\n\`${err.message}\``);
    } catch (_) {}
    process.exit(1);
  }
}

main();
