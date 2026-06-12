import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`select name, slots, meal from medicines order by id`;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/meds error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    await sql`insert into medicines (name, slots, meal)
              values (${b.name}, ${b.slots}, ${b.meal})`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/meds error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get("name") || "";
    await sql`delete from medicines where name = ${name}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/meds error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}