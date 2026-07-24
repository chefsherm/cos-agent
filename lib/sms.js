// Optional SMS delivery via Twilio's REST API (no SDK dependency).
// If credentials aren't configured, this is a graceful no-op so the app
// stays fully usable with copy-link only.

export function smsConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );
}

export async function sendSms(to, body) {
  if (!smsConfigured()) return { sent: false, reason: "not_configured" };
  if (!to) return { sent: false, reason: "no_recipient" };

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const auth = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${sid}:${auth}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
      }
    );
    if (!res.ok) {
      const detail = await res.text();
      console.error("Twilio send failed:", res.status, detail.slice(0, 300));
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (e) {
    console.error("Twilio send error:", e);
    return { sent: false, reason: "exception" };
  }
}
