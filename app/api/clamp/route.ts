import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await sql`
      select id, clamp_time, release_time, detected, urine_ml
      from clamp_sessions order by clamp_time desc limit 500`;
    return NextResponse.json(rows);
  } catch (err) {
    console.error("GET /api/clamp error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// start a clamp -> returns the new session id
export async function POST() {
  try {
    const rows = await sql`
      insert into clamp_sessions (clamp_time) values (now())
      returning id`;
    return NextResponse.json({ ok: true, id: rows[0].id });
  } catch (err) {
    console.error("POST /api/clamp error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// update a session: clamp time, release time, detected, urine ml
export async function PATCH(req: NextRequest) {
  try {
    const b = await req.json();
    const id = Number(b.id);
    if (!id) throw new Error("missing id");

    if (b.clamp_time !== undefined) {
      await sql`update clamp_sessions set clamp_time = ${b.clamp_time} where id = ${id}`;
    }
    if (b.release_time !== undefined) {
      await sql`update clamp_sessions set release_time = ${b.release_time} where id = ${id}`;
    }
    if (b.detected !== undefined || b.urine_ml !== undefined) {
      const ml =
        b.urine_ml === "" || b.urine_ml === undefined || b.urine_ml === null
          ? null
          : Number(b.urine_ml);
      await sql`
        update clamp_sessions
        set detected = ${b.detected ?? null}, urine_ml = ${ml}
        where id = ${id}`;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/clamp error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

// delete a session
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id) throw new Error("missing id");
    await sql`delete from clamp_sessions where id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/clamp error:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}