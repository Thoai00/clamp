import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`
      select time, type, detail, duration, detected
      from logs order by time desc limit 500`;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/logs error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const duration =
      b.duration === "" || b.duration === undefined || b.duration === null
        ? null
        : Number(b.duration);
    await sql`
      insert into logs (time, type, detail, duration, detected)
      values (${b.time || new Date().toISOString()}, ${b.type}, ${b.detail || ""},
              ${duration}, ${b.detected || ""})`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/logs error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}