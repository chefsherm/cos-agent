import { getData, saveData } from "@/lib/data";

export async function GET() {
  try {
    const data = await getData();
    return Response.json(data);
  } catch (err) {
    console.error("GET /api/data error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { ventures, decisions } = await req.json();
    if (!ventures || !decisions) {
      return Response.json({ error: "ventures and decisions required" }, { status: 400 });
    }
    await saveData(ventures, decisions);
    return Response.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/data error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
