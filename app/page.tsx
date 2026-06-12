"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const PATIENT = { name: "Paithui Chak", age: 60 };

type Slot = "Morning" | "Afternoon" | "Night";
type Meal = "Before eat" | "After eat";
type Med = { name: string; slots: Slot[]; meal: Meal };

type ClampSession = {
  id: number;
  clamp_time: string;
  release_time: string | null;
  detected: string | null;
  urine_ml: number | null;
};

const SLOTS: Slot[] = ["Morning", "Afternoon", "Night"];
const MEALS: Meal[] = ["Before eat", "After eat"];

// Bangla display labels (data stays in English in the database)
const SLOT_BN: Record<Slot, string> = {
  Morning: "সকাল",
  Afternoon: "দুপুর",
  Night: "রাত",
};
const MEAL_BN: Record<Meal, string> = {
  "Before eat": "খাওয়ার আগে",
  "After eat": "খাওয়ার পরে",
};

/* ---------- helpers ---------- */

function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${ss}`;
}

function fmtTime(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("bn-BD", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function durationMin(a: string, b: string | null) {
  if (!b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

export default function Home() {
  const [tab, setTab] = useState<"clamp" | "medicine">("clamp");
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // clamp state
  const [sessions, setSessions] = useState<ClampSession[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [clampStart, setClampStart] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [releaseTime, setReleaseTime] = useState<string | null>(null);
  const [urineMl, setUrineMl] = useState("");

  // medicine state
  const [meds, setMeds] = useState<Med[]>([]);
  const [newName, setNewName] = useState("");
  const [newSlots, setNewSlots] = useState<Slot[]>([]);
  const [newMeal, setNewMeal] = useState<Meal>("After eat");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const ai = localStorage.getItem("activeId");
    const cs = localStorage.getItem("clampStart");
    const pi = localStorage.getItem("pendingId");
    const rt = localStorage.getItem("releaseTime");
    if (ai) setActiveId(Number(ai));
    if (cs) setClampStart(cs);
    if (pi) setPendingId(Number(pi));
    if (rt) setReleaseTime(rt);
    fetchSessions();
    fetchMeds();
  }, []);

  function showToast(msg: string, err = false) {
    clearTimeout(toastTimer.current);
    setToast({ msg, err });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  /* ---------- data ---------- */

  async function fetchSessions() {
    try {
      setSyncing(true);
      const res = await fetch("/api/clamp");
      const data = await res.json();
      if (Array.isArray(data)) setSessions(data);
    } catch {
      showToast("ক্ল্যাম্পের রেকর্ড লোড করা যায়নি", true);
    } finally {
      setSyncing(false);
    }
  }

  async function fetchMeds() {
    try {
      const res = await fetch("/api/meds");
      const data = await res.json();
      if (Array.isArray(data)) {
        setMeds(
          data.map((m: { name: string; slots: string; meal: string }) => ({
            name: String(m.name),
            slots: String(m.slots)
              .split(",")
              .filter((x) => SLOTS.includes(x as Slot)) as Slot[],
            meal: (m.meal === "Before eat" ? "Before eat" : "After eat") as Meal,
          }))
        );
      }
    } catch {
      showToast("ওষুধ লোড করা যায়নি", true);
    }
  }

  /* ---------- clamp actions ---------- */

  async function startClamp() {
    const t = new Date().toISOString();
    setClampStart(t);
    localStorage.setItem("clampStart", t);
    try {
      setSyncing(true);
      const res = await fetch("/api/clamp", { method: "POST" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setActiveId(j.id);
      localStorage.setItem("activeId", String(j.id));
      showToast("ক্ল্যাম্প শুরু হয়েছে ✓");
    } catch (err) {
      showToast("সংরক্ষণ হয়নি: " + String(err), true);
      setClampStart(null);
      localStorage.removeItem("clampStart");
    } finally {
      setSyncing(false);
    }
  }

  async function undoClamp() {
    if (!activeId) return;
    const t = new Date().toISOString();
    try {
      setSyncing(true);
      const res = await fetch("/api/clamp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeId, release_time: t }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setPendingId(activeId);
      setReleaseTime(t);
      localStorage.setItem("pendingId", String(activeId));
      localStorage.setItem("releaseTime", t);
      setActiveId(null);
      setClampStart(null);
      localStorage.removeItem("activeId");
      localStorage.removeItem("clampStart");
      showToast("ক্ল্যাম্প খোলা হয়েছে ✓");
    } catch (err) {
      showToast("সংরক্ষণ হয়নি: " + String(err), true);
    } finally {
      setSyncing(false);
    }
  }

  async function logPee(detected: boolean) {
    if (!pendingId) return;
    try {
      setSyncing(true);
      const res = await fetch("/api/clamp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pendingId,
          detected: detected ? "Yes" : "No",
          urine_ml: urineMl,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setPendingId(null);
      setReleaseTime(null);
      setUrineMl("");
      localStorage.removeItem("pendingId");
      localStorage.removeItem("releaseTime");
      await fetchSessions();
      showToast("প্রস্রাব রেকর্ড হয়েছে ✓");
    } catch (err) {
      showToast("সংরক্ষণ হয়নি: " + String(err), true);
    } finally {
      setSyncing(false);
    }
  }

  /* ---------- medicine actions ---------- */

  function toggleNewSlot(s: Slot) {
    setNewSlots((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  }

  async function addMed() {
    const name = newName.trim();
    if (!name) return showToast("ওষুধের নাম লিখুন", true);
    if (newSlots.length === 0) return showToast("অন্তত একটি সময় বাছুন", true);
    const med: Med = { name, slots: newSlots, meal: newMeal };
    setMeds((m) => [...m, med]);
    setNewName("");
    setNewSlots([]);
    setNewMeal("After eat");
    try {
      const res = await fetch("/api/meds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: med.name,
          slots: med.slots.join(","),
          meal: med.meal,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      showToast("ওষুধ সংরক্ষণ হয়েছে ✓");
    } catch (err) {
      showToast("সংরক্ষণ হয়নি: " + String(err), true);
    }
  }

  async function removeMed(name: string) {
    setMeds((m) => m.filter((x) => x.name !== name));
    try {
      await fetch(`/api/meds?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
    } catch {
      showToast("ডাটাবেস থেকে মুছতে ব্যর্থ", true);
    }
  }

  /* ---------- derived ---------- */

  const clampElapsed = clampStart ? now - new Date(clampStart).getTime() : 0;

  const todaySessions = useMemo(
    () => sessions.filter((s) => isToday(s.clamp_time)),
    [sessions]
  );

  const todayMl = useMemo(
    () => todaySessions.reduce((sum, s) => sum + (s.urine_ml || 0), 0),
    [todaySessions]
  );

  function medsFor(slot: Slot, meal: Meal) {
    return meds.filter((m) => m.slots.includes(slot) && m.meal === meal);
  }

  const dateChip = new Date().toLocaleDateString("bn-BD", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
      active
        ? "border-[#0e5e4e] bg-[#0e5e4e] text-white"
        : "border-[#e2e9e6] bg-white text-[#5b6f6b]"
    }`;

  return (
    <main className="min-h-screen bg-[#f3f6f4] text-[#122b27] font-sans">
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-4">
        {/* top bar */}
        <div className="flex items-center justify-between py-3">
          <div className="text-xl font-extrabold tracking-tight text-[#0a3f35]">
            Clamp<span className="text-[#e8743b]">Care</span>
          </div>
          <div className="rounded-full border border-[#e2e9e6] bg-white px-3 py-1.5 text-sm text-[#5b6f6b]">
            {dateChip}
          </div>
        </div>

        {/* patient card */}
        <div className="mb-4 flex items-center gap-4 rounded-2xl border border-[#e2e9e6] bg-white p-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#d9efe7] text-xl font-extrabold text-[#0a3f35]">
            PC
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{PATIENT.name}</h1>
            <p className="mt-0.5 text-sm text-[#5b6f6b]">
              {PATIENT.age} বছর · ক্যাথেটার ক্ল্যাম্প ট্রেনিং
            </p>
          </div>
        </div>

        {/* tabs */}
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-[#e2e9e6] bg-white p-1.5">
          <button
            onClick={() => setTab("clamp")}
            className={`rounded-xl py-2.5 text-sm font-semibold transition ${
              tab === "clamp" ? "bg-[#0e5e4e] text-white" : "text-[#5b6f6b]"
            }`}
          >
            ক্ল্যাম্প ও প্রস্রাব
          </button>
          <button
            onClick={() => setTab("medicine")}
            className={`rounded-xl py-2.5 text-sm font-semibold transition ${
              tab === "medicine" ? "bg-[#0e5e4e] text-white" : "text-[#5b6f6b]"
            }`}
          >
            ওষুধ
          </button>
        </div>

        {/* ================= CLAMP TAB ================= */}
        {tab === "clamp" && (
          <div className="grid gap-4">
            {/* timer */}
            <section
              className={`rounded-3xl border p-5 transition-colors duration-300 ${
                activeId
                  ? "border-[#0a3f35] bg-[#0a3f35] text-[#eafff7]"
                  : "border-[#e2e9e6] bg-white"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    activeId ? "animate-pulse bg-[#4be3ad]" : "bg-[#5b6f6b]"
                  }`}
                />
                {activeId ? "ক্ল্যাম্প চালু আছে" : "ক্ল্যাম্প খোলা আছে"}
              </div>

              <div className="my-2 text-6xl font-extrabold tabular-nums tracking-tight sm:text-7xl">
                {activeId ? fmtClock(clampElapsed) : "00:00:00"}
              </div>

              <div
                className={`text-sm ${
                  activeId ? "text-[#9fd8c6]" : "text-[#5b6f6b]"
                }`}
              >
                {activeId
                  ? `${fmtTime(clampStart)} এ ক্ল্যাম্প করা হয়েছে — চলছে`
                  : pendingId
                  ? `${fmtTime(releaseTime)} এ খোলা হয়েছে — নিচে প্রস্রাব লিখুন`
                  : "ক্ল্যাম্প বন্ধ করলে শুরু চাপুন"}
              </div>

              {activeId ? (
                <button
                  onClick={undoClamp}
                  className="mt-4 w-full rounded-2xl bg-[#e8743b] py-4 text-base font-semibold text-white transition active:scale-[0.98]"
                >
                  ক্ল্যাম্প খুলুন (এখন খুলে দিন)
                </button>
              ) : !pendingId ? (
                <button
                  onClick={startClamp}
                  className="mt-4 w-full rounded-2xl bg-[#0e5e4e] py-4 text-base font-semibold text-white transition active:scale-[0.98]"
                >
                  ক্ল্যাম্প শুরু করুন
                </button>
              ) : null}

              {/* pee panel with urine ml */}
              {pendingId && (
                <div className="mt-4 rounded-2xl border border-dashed border-[#e8743b] bg-[#fdeee4] p-4">
                  <p className="mb-3 text-sm font-semibold text-[#122b27]">
                    প্রস্রাবের পরিমাণ (মিলি)
                  </p>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={urineMl}
                    onChange={(e) => setUrineMl(e.target.value)}
                    placeholder="যেমন ২৫০"
                    className="mb-3 w-full rounded-xl border border-[#e2e9e6] bg-white p-3.5 text-base outline-none focus:ring-2 focus:ring-[#0e5e4e]"
                  />
                  <p className="mb-2 text-sm font-semibold text-[#122b27]">
                    রোগী কি বুঝতে পেরেছেন (প্রস্রাবের চাপ টের পেয়েছেন)?
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => logPee(true)}
                      className="rounded-xl bg-[#0e5e4e] py-3.5 text-sm font-semibold text-white transition active:scale-[0.98]"
                    >
                      হ্যাঁ, টের পেয়েছেন
                    </button>
                    <button
                      onClick={() => logPee(false)}
                      className="rounded-xl bg-[#d9efe7] py-3.5 text-sm font-semibold text-[#0a3f35] transition active:scale-[0.98]"
                    >
                      না, টের পাননি
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* today summary */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-[#e2e9e6] bg-white p-3 text-center">
                <b className="block text-2xl font-bold">{todaySessions.length}</b>
                <span className="text-[11px] text-[#5b6f6b]">আজকের ক্ল্যাম্প</span>
              </div>
              <div className="rounded-2xl border border-[#e2e9e6] bg-white p-3 text-center">
                <b className="block text-2xl font-bold">{todayMl} মিলি</b>
                <span className="text-[11px] text-[#5b6f6b]">আজকের প্রস্রাব</span>
              </div>
            </div>

            {/* clamp table */}
            <section className="rounded-2xl border border-[#e2e9e6] bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#5b6f6b]">
                  ক্ল্যাম্পের রেকর্ড
                </p>
                <span className="text-xs text-[#5b6f6b]">
                  {syncing ? "সিঙ্ক হচ্ছে…" : ""}
                </span>
              </div>

              {sessions.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#5b6f6b]">
                  এখনো কোনো ক্ল্যাম্প নেই। শুরু করতে উপরে ক্ল্যাম্প শুরু করুন।
                </p>
              ) : (
                <div className="-mx-1 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wide text-[#5b6f6b]">
                        <th className="px-2 py-2 font-semibold">ক্ল্যাম্প সময়</th>
                        <th className="px-2 py-2 font-semibold">খোলার সময়</th>
                        <th className="px-2 py-2 font-semibold">সময়কাল</th>
                        <th className="px-2 py-2 font-semibold">টের পেয়েছে</th>
                        <th className="px-2 py-2 font-semibold">প্রস্রাব</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map((s) => {
                        const dur = durationMin(s.clamp_time, s.release_time);
                        return (
                          <tr
                            key={s.id}
                            className="border-t border-[#e2e9e6] align-top"
                          >
                            <td className="whitespace-nowrap px-2 py-2.5">
                              {fmtTime(s.clamp_time)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2.5">
                              {fmtTime(s.release_time)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2.5">
                              {dur === null ? "—" : `${dur} মি`}
                            </td>
                            <td className="px-2 py-2.5">
                              {s.detected ? (
                                <span
                                  className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                                    s.detected === "Yes"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-orange-100 text-orange-800"
                                  }`}
                                >
                                  {s.detected === "Yes" ? "হ্যাঁ" : "না"}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2.5 font-semibold">
                              {s.urine_ml != null ? `${s.urine_ml} মিলি` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= MEDICINE TAB ================= */}
        {tab === "medicine" && (
          <div className="grid gap-4">
            {/* add medicine */}
            <section className="rounded-2xl border border-[#e2e9e6] bg-white p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5b6f6b]">
                ওষুধ যোগ করুন
              </p>
              <div className="grid gap-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ওষুধের নাম যেমন Tamsol 0.4"
                  className="rounded-xl border border-[#e2e9e6] bg-[#f3f6f4] p-3.5 text-base outline-none focus:ring-2 focus:ring-[#0e5e4e]"
                />
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#5b6f6b]">
                    কখন (এক বা একাধিক বাছুন)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SLOTS.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleNewSlot(s)}
                        className={chip(newSlots.includes(s))}
                      >
                        {SLOT_BN[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#5b6f6b]">
                    খাওয়ার আগে নাকি পরে
                  </p>
                  <div className="flex gap-2">
                    {MEALS.map((m) => (
                      <button
                        key={m}
                        onClick={() => setNewMeal(m)}
                        className={chip(newMeal === m)}
                      >
                        {MEAL_BN[m]}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={addMed}
                  className="rounded-xl bg-[#0e5e4e] py-3.5 text-sm font-semibold text-white transition active:scale-[0.98]"
                >
                  ওষুধ সংরক্ষণ করুন
                </button>
              </div>
            </section>

            {/* grouped schedule */}
            {SLOTS.map((slot) => (
              <section
                key={slot}
                className="rounded-2xl border border-[#e2e9e6] bg-white p-4"
              >
                <p className="mb-3 text-sm font-bold text-[#0a3f35]">
                  {SLOT_BN[slot]}
                </p>
                <div className="grid gap-3">
                  {MEALS.map((meal) => {
                    const list = medsFor(slot, meal);
                    return (
                      <div key={meal}>
                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#5b6f6b]">
                          {MEAL_BN[meal]}
                        </p>
                        {list.length === 0 ? (
                          <p className="text-sm text-[#b6c2bd]">— কিছু নেই —</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {list.map((m) => (
                              <span
                                key={m.name + slot + meal}
                                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                                  meal === "Before eat"
                                    ? "bg-blue-50 text-blue-800"
                                    : "bg-[#d9efe7] text-[#0a3f35]"
                                }`}
                              >
                                {m.name}
                                <button
                                  onClick={() => removeMed(m.name)}
                                  aria-label={`${m.name} মুছুন`}
                                  className="font-bold text-red-500"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 w-[calc(100%-32px)] max-w-md -translate-x-1/2 rounded-2xl px-5 py-3 text-center text-sm text-white shadow-xl ${
            toast.err ? "bg-red-700" : "bg-[#122b27]"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </main>
  );
}