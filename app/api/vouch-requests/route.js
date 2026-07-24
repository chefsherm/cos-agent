import { listRequests, createRequest } from "@/lib/vouches";
import { sendSms, smsConfigured } from "@/lib/sms";

// GET /api/vouch-requests?requester=Name — list a member's vouch requests
export async function GET(req) {
  try {
    const requester = new URL(req.url).searchParams.get("requester") || "";
    const rows = await listRequests(requester);
    // Strip phone numbers from the listing payload.
    const safe = rows.map(({ contactPhone, vouch, ...rest }) => ({
      ...rest,
      hasPhone: !!contactPhone,
      vouch: vouch ? { summary: vouch.summary } : null,
    }));
    return Response.json({ requests: safe, smsEnabled: smsConfigured() });
  } catch (err) {
    console.error("vouch-requests GET error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/vouch-requests — create a request, optionally text the link
export async function POST(req) {
  try {
    const { requester, contactName, contactPhone, origin } = await req.json();
    if (!requester?.trim()) return Response.json({ error: "Add your name first." }, { status: 400 });
    if (!contactName?.trim())
      return Response.json({ error: "Add the person's name." }, { status: 400 });

    const request = await createRequest({ requester, contactName, contactPhone });
    const base = origin || process.env.NEXT_PUBLIC_URL || "";
    const link = `${base}/vouch/${request.token}`;

    let sms = { sent: false };
    if (contactPhone?.trim()) {
      const body = `${requester.trim()} asked us to collect a quick vouch for their work on Candidate Collective — trust is the only currency here. It's a 2-minute chat: ${link}`;
      sms = await sendSms(contactPhone.trim(), body);
    }

    return Response.json({
      request: { token: request.token, contactName: request.contactName, status: request.status, createdAt: request.createdAt, hasPhone: !!contactPhone?.trim() },
      link,
      sms,
    });
  } catch (err) {
    console.error("vouch-requests POST error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
