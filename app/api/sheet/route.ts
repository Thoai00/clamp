import { NextRequest, NextResponse } from "next/server";

// Your Apps Script web app URL
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyKZiEO-ykncm2N55QVRkxYN7U_thou9xRkwkn3BWq7GSoOAPWA4yP2r6xoQWVyfcKg1g/exec";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const qs = req.nextUrl.search; // forwards ?action=insert&... as-is
    const res = await fetch(SCRIPT_URL + qs, {
      redirect: "follow",
      cache: "no-store",
    });
    const txt = await res.text();
    try {
      return NextResponse.json(JSON.parse(txt));
    } catch {
      // Apps Script sent an HTML page (login/error) — show the real reason
      return NextResponse.json(
        {
          ok: false,
          error:
            "Apps Script did not return JSON. First 300 chars: " +
            txt.slice(0, 300),
        },
        { status: 502 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 502 }
    );
  }
}