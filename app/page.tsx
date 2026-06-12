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
    hour12: true,
  });
}

function durationMin(a: string, b: string | null) {
  if (!b) return null;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
}

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function localInputToISO(val: string) {
  if (!val) return null;
  return new Date(val).toISOString();
}

function isoToLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Home() {
  const [tab, setTab] = useState<"clamp" | "medicine">("clamp");
  const [now, setNow] = useState(Date.now());
  const [toast, setToast] = useState<{ msg: string; err: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [sessions, setSessions] = useState<ClampSession[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [clampStart, setClampStart] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [releaseTime, setReleaseTime] = useState<string | null>(null);
  const [urineMl, setUrineMl] = useState("");

  const [showManual, setShowManual] = useState(false);
  const [manualClampTime, setManualClampTime] = useState("");
  const [manualReleaseTime, setManualReleaseTime] = useState("");
  const [manualDetected, setManualDetected] = useState<"Yes" | "No" | "">("");
  const [manualUrineMl, setManualUrineMl] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editClampTime, setEditClampTime] = useState("");
  const [editReleaseTime, setEditReleaseTime] = useState("");
  const [editDetected, setEditDetected] = useState<"Yes" | "No" | "">("");
  const [editUrineMl, setEditUrineMl] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [openMedMenu, setOpenMedMenu] = useState<string | null>(null);
  const [deleteMedName, setDeleteMedName] = useState<string | null>(null);

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

  useEffect(() => {
    if (showManual && !manualClampTime) {
      setManualClampTime(isoToLocalInput(new Date().toISOString()));
    }
  }, [showManual]);

  function showToast(msg: string, err = false) {
    clearTimeout(toastTimer.current);
    setToast({ msg, err });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

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

  async function saveManualEntry() {
    if (!manualClampTime) return showToast("ক্ল্যাম্পের সময় দিন", true);
    const clampISO = localInputToISO(manualClampTime);
    const releaseISO = manualReleaseTime ? localInputToISO(manualReleaseTime) : null;

    if (releaseISO && clampISO && new Date(releaseISO) <= new Date(clampISO)) {
      return showToast("খোলার সময় ক্ল্যাম্পের সময়ের পরে হতে হবে", true);
    }

    setManualSaving(true);
    try {
      const res1 = await fetch("/api/clamp", { method: "POST" });
      const j1 = await res1.json();
      if (!j1.ok) throw new Error(j1.error);
      const newId = j1.id;

      await fetch("/api/clamp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId, clamp_time: clampISO }),
      });

      if (releaseISO) {
        await fetch("/api/clamp", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: newId,
            release_time: releaseISO,
            detected: manualDetected || null,
            urine_ml: manualUrineMl || null,
          }),
        });
      }

      setManualClampTime("");
      setManualReleaseTime("");
      setManualDetected("");
      setManualUrineMl("");
      setShowManual(false);
      await fetchSessions();
      showToast("ম্যানুয়াল এন্ট্রি সংরক্ষণ হয়েছে ✓");
    } catch (err) {
      showToast("সংরক্ষণ হয়নি: " + String(err), true);
    } finally {
      setManualSaving(false);
    }
  }

  function openEdit(s: ClampSession) {
    setEditingId(s.id);
    setEditClampTime(isoToLocalInput(s.clamp_time));
    setEditReleaseTime(isoToLocalInput(s.release_time));
    setEditDetected((s.detected as "Yes" | "No" | "") || "");
    setEditUrineMl(s.urine_ml != null ? String(s.urine_ml) : "");
  }

  function closeEdit() {
    setEditingId(null);
    setEditClampTime("");
    setEditReleaseTime("");
    setEditDetected("");
    setEditUrineMl("");
  }

  async function saveEditEntry() {
    if (!editingId) return;
    if (!editClampTime) return showToast("ক্ল্যাম্পের সময় দিন", true);

    const clampISO = localInputToISO(editClampTime);
    const releaseISO = editReleaseTime ? localInputToISO(editReleaseTime) : null;

    if (releaseISO && clampISO && new Date(releaseISO) <= new Date(clampISO)) {
      return showToast("খোলার সময় ক্ল্যাম্পের সময়ের পরে হতে হবে", true);
    }

    setEditSaving(true);
    try {
      const res = await fetch("/api/clamp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          clamp_time: clampISO,
          release_time: releaseISO,
          detected: editDetected || null,
          urine_ml: editUrineMl === "" ? null : editUrineMl,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      closeEdit();
      await fetchSessions();
      showToast("রেকর্ড আপডেট হয়েছে ✓");
    } catch (err) {
      showToast("আপডেট হয়নি: " + String(err), true);
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clamp?id=${deleteId}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setDeleteId(null);
      await fetchSessions();
      showToast("রেকর্ড মুছে ফেলা হয়েছে ✓");
    } catch (err) {
      showToast("মুছতে ব্যর্থ: " + String(err), true);
    } finally {
      setDeleting(false);
    }
  }

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

  const inputCls =
    "w-full rounded-xl border border-[#e2e9e6] bg-[#f3f6f4] p-3 text-sm outline-none focus:ring-2 focus:ring-[#0e5e4e]";

  // Unified card style — used for every card so they all match perfectly
  const cardCls = "rounded-2xl border border-[#e2e9e6] bg-white p-4";

  return (
    <main className="min-h-screen bg-[#f3f6f4] text-[#122b27] font-sans">
      {/*
        KEY FIX: Single wrapper with consistent px-4 on all screen sizes.
        No asymmetric sm: overrides that were causing the misalignment.
        max-w-lg centers on tablet/desktop while filling mobile edge-to-edge minus 16px each side.
      */}
      <div className="mx-auto w-full max-w-lg px-4 pb-24 pt-4">

        {/* top bar */}
        <div className="flex items-center justify-between py-3">
          <div className="text-lg font-extrabold tracking-tight text-[#0a3f35]">
            Clamp<span className="text-[#e8743b]">Care</span>
          </div>
          <div className="rounded-full border border-[#e2e9e6] bg-white px-3 py-1 text-xs text-[#5b6f6b]">
            {dateChip}
          </div>
        </div>

        {/* patient card */}
        <div className={`mb-3 flex items-center gap-3 ${cardCls}`}>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#d9efe7] text-base font-extrabold text-[#0a3f35]">
            PC
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight">
              {PATIENT.name}
            </h1>
            <p className="mt-0.5 text-xs text-[#5b6f6b]">
              {PATIENT.age} বছর · ক্যাথেটার ক্ল্যাম্প ট্রেনিং
            </p>
          </div>
        </div>

        {/* tabs */}
        <div className="mb-3 grid grid-cols-2 gap-1.5 rounded-2xl border border-[#e2e9e6] bg-white p-1">
          <button
            onClick={() => setTab("clamp")}
            className={`rounded-xl py-2 text-sm font-semibold transition ${
              tab === "clamp" ? "bg-[#0e5e4e] text-white" : "text-[#5b6f6b]"
            }`}
          >
            ক্ল্যাম্প ও প্রস্রাব
          </button>
          <button
            onClick={() => setTab("medicine")}
            className={`rounded-xl py-2 text-sm font-semibold transition ${
              tab === "medicine" ? "bg-[#0e5e4e] text-white" : "text-[#5b6f6b]"
            }`}
          >
            ওষুধ
          </button>
        </div>

        {/* ================= CLAMP TAB ================= */}
        {tab === "clamp" && (
          <div className="grid gap-3">

            {/* timer card */}
            <section
              className={`rounded-2xl border p-4 transition-colors duration-300 ${
                activeId
                  ? "border-[#0a3f35] bg-[#0a3f35] text-[#eafff7]"
                  : "border-[#e2e9e6] bg-white"
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                <span
                  className={`h-2 w-2 rounded-full ${
                    activeId ? "animate-pulse bg-[#4be3ad]" : "bg-[#5b6f6b]"
                  }`}
                />
                {activeId ? "ক্ল্যাম্প চালু আছে" : "ক্ল্যাম্প খোলা আছে"}
              </div>

              <div className="my-2 text-5xl font-extrabold tabular-nums tracking-tight">
                {activeId ? fmtClock(clampElapsed) : "00:00:00"}
              </div>

              <div
                className={`text-xs ${
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
                  className="mt-4 w-full rounded-2xl bg-[#e8743b] py-3.5 text-sm font-semibold text-white transition active:scale-[0.98]"
                >
                  ক্ল্যাম্প খুলুন (এখন খুলে দিন)
                </button>
              ) : !pendingId ? (
                <button
                  onClick={startClamp}
                  className="mt-4 w-full rounded-2xl bg-[#0e5e4e] py-3.5 text-sm font-semibold text-white transition active:scale-[0.98]"
                >
                  ক্ল্যাম্প শুরু করুন
                </button>
              ) : null}

              {/* pee panel */}
              {pendingId && (
                <div className="mt-4 rounded-2xl border border-dashed border-[#e8743b] bg-[#fdeee4] p-3">
                  <p className="mb-2 text-sm font-semibold text-[#122b27]">
                    প্রস্রাবের পরিমাণ (মিলি)
                  </p>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={urineMl}
                    onChange={(e) => setUrineMl(e.target.value)}
                    placeholder="যেমন ২৫০"
                    className="mb-3 w-full rounded-xl border border-[#e2e9e6] bg-white p-3 text-sm outline-none focus:ring-2 focus:ring-[#0e5e4e]"
                  />
                  <p className="mb-2 text-sm font-semibold text-[#122b27]">
                    রোগী কি প্রস্রাবের চাপ টের পেয়েছেন?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => logPee(true)}
                      className="rounded-xl bg-[#0e5e4e] py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
                    >
                      হ্যাঁ, টের পেয়েছেন
                    </button>
                    <button
                      onClick={() => logPee(false)}
                      className="rounded-xl bg-[#d9efe7] py-3 text-sm font-semibold text-[#0a3f35] transition active:scale-[0.98]"
                    >
                      না, টের পাননি
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* today summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`${cardCls} text-center`}>
                <b className="block text-2xl font-bold">{todaySessions.length}</b>
                <span className="text-[11px] text-[#5b6f6b]">আজকের ক্ল্যাম্প</span>
              </div>
              <div className={`${cardCls} text-center`}>
                <b className="block text-2xl font-bold">{todayMl} মিলি</b>
                <span className="text-[11px] text-[#5b6f6b]">আজকের প্রস্রাব</span>
              </div>
            </div>

            {/* manual entry toggle */}
            <button
              onClick={() => setShowManual((v) => !v)}
              className="flex w-full items-center justify-between rounded-2xl border border-dashed border-[#0e5e4e] bg-white px-4 py-3 text-sm font-semibold text-[#0e5e4e] transition hover:bg-[#d9efe7]"
            >
              <span>✏️ ম্যানুয়ালি ডেটা যোগ করুন</span>
              <span className="text-lg">{showManual ? "−" : "+"}</span>
            </button>

            {/* manual entry form */}
            {showManual && (
              <section className={cardCls}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5b6f6b]">
                  ম্যানুয়াল এন্ট্রি
                </p>
                <div className="grid gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#5b6f6b]">
                      ক্ল্যাম্পের সময় *
                    </label>
                    <input
                      type="datetime-local"
                      value={manualClampTime}
                      onChange={(e) => setManualClampTime(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#5b6f6b]">
                      খোলার সময় (ঐচ্ছিক)
                    </label>
                    <input
                      type="datetime-local"
                      value={manualReleaseTime}
                      onChange={(e) => setManualReleaseTime(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#5b6f6b]">
                      প্রস্রাবের পরিমাণ (মিলি, ঐচ্ছিক)
                    </label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={manualUrineMl}
                      onChange={(e) => setManualUrineMl(e.target.value)}
                      placeholder="যেমন ২৫০"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[#5b6f6b]">
                      প্রস্রাবের চাপ টের পেয়েছেন? (ঐচ্ছিক)
                    </label>
                    <div className="flex gap-2">
                      {(["Yes", "No", ""] as const).map((v) => (
                        <button
                          key={v === "" ? "skip" : v}
                          onClick={() => setManualDetected(v)}
                          className={chip(manualDetected === v)}
                        >
                          {v === "Yes" ? "হ্যাঁ" : v === "No" ? "না" : "উল্লেখ নেই"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        setShowManual(false);
                        setManualClampTime("");
                        setManualReleaseTime("");
                        setManualDetected("");
                        setManualUrineMl("");
                      }}
                      className="rounded-xl border border-[#e2e9e6] py-3 text-sm font-semibold text-[#5b6f6b] transition active:scale-[0.98]"
                    >
                      বাতিল
                    </button>
                    <button
                      onClick={saveManualEntry}
                      disabled={manualSaving}
                      className="rounded-xl bg-[#0e5e4e] py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
                    >
                      {manualSaving ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* clamp records — stacked cards, fully responsive on all screen sizes */}
            <section className={cardCls}>
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
                <div className="flex flex-col gap-2">
                  {sessions.map((s) => {
                    const dur = durationMin(s.clamp_time, s.release_time);
                    return (
                      <div
                        key={s.id}
                        className="rounded-xl border border-[#e2e9e6] bg-[#f9fbfa] p-3"
                      >
                        {/* row 1: clamp → release times */}
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                          <span className="font-semibold text-[#0a3f35]">
                            {fmtTime(s.clamp_time)}
                          </span>
                          <span className="text-[#b6c2bd]">→</span>
                          <span className="text-[#5b6f6b]">
                            {fmtTime(s.release_time)}
                          </span>
                          {dur !== null && (
                            <span className="rounded-full bg-[#d9efe7] px-2 py-0.5 text-[10px] font-semibold text-[#0a3f35]">
                              {dur} মি
                            </span>
                          )}
                        </div>

                        {/* row 2: detected + urine badges */}
                        <div className="mb-2.5 flex flex-wrap gap-2">
                          {s.detected ? (
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                                s.detected === "Yes"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-orange-100 text-orange-800"
                              }`}
                            >
                              {s.detected === "Yes" ? "টের পেয়েছেন ✓" : "টের পাননি"}
                            </span>
                          ) : null}
                          {s.urine_ml != null ? (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                              {s.urine_ml} মিলি
                            </span>
                          ) : null}
                        </div>

                        {/* row 3: action buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEdit(s)}
                            className="flex-1 rounded-lg border border-[#e2e9e6] bg-white py-2 text-xs font-semibold text-[#0e5e4e] transition active:scale-[0.97]"
                          >
                            সম্পাদনা
                          </button>
                          <button
                            onClick={() => setDeleteId(s.id)}
                            className="flex-1 rounded-lg border border-red-200 bg-white py-2 text-xs font-semibold text-red-600 transition active:scale-[0.97]"
                          >
                            মুছুন
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================= MEDICINE TAB ================= */}
        {tab === "medicine" && (
          <div className="grid gap-3">
            {/* add medicine */}
            <section className={cardCls}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#5b6f6b]">
                ওষুধ যোগ করুন
              </p>
              <div className="grid gap-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="ওষুধের নাম যেমন Tamsol 0.4"
                  className={inputCls}
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
                  className="rounded-xl bg-[#0e5e4e] py-3 text-sm font-semibold text-white transition active:scale-[0.98]"
                >
                  ওষুধ সংরক্ষণ করুন
                </button>
              </div>
            </section>

            {/* grouped schedule */}
            {SLOTS.map((slot) => (
              <section key={slot} className={cardCls}>
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
                                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-sm font-medium ${
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

      {/* edit modal */}
      {editingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#e2e9e6] bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-[#0a3f35]">রেকর্ড সম্পাদনা করুন</p>
              <button
                onClick={closeEdit}
                className="rounded-lg px-2 py-1 text-lg font-bold text-[#5b6f6b] transition hover:bg-[#f3f6f4]"
              >
                ×
              </button>
            </div>
            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5b6f6b]">
                  ক্ল্যাম্পের সময় *
                </label>
                <input
                  type="datetime-local"
                  value={editClampTime}
                  onChange={(e) => setEditClampTime(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5b6f6b]">
                  খোলার সময় (ঐচ্ছিক)
                </label>
                <input
                  type="datetime-local"
                  value={editReleaseTime}
                  onChange={(e) => setEditReleaseTime(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#5b6f6b]">
                  প্রস্রাবের পরিমাণ (মিলি, ঐচ্ছিক)
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={editUrineMl}
                  onChange={(e) => setEditUrineMl(e.target.value)}
                  placeholder="যেমন ২৫০"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#5b6f6b]">
                  প্রস্রাবের চাপ টের পেয়েছেন? (ঐচ্ছিক)
                </label>
                <div className="flex gap-2">
                  {(["Yes", "No", ""] as const).map((v) => (
                    <button
                      key={v === "" ? "skip" : v}
                      onClick={() => setEditDetected(v)}
                      className={chip(editDetected === v)}
                    >
                      {v === "Yes" ? "হ্যাঁ" : v === "No" ? "না" : "উল্লেখ নেই"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={closeEdit}
                  className="rounded-xl border border-[#e2e9e6] py-3 text-sm font-semibold text-[#5b6f6b] transition active:scale-[0.98]"
                >
                  বাতিল
                </button>
                <button
                  onClick={saveEditEntry}
                  disabled={editSaving}
                  className="rounded-xl bg-[#0e5e4e] py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
                >
                  {editSaving ? "সংরক্ষণ হচ্ছে…" : "সংরক্ষণ করুন"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* delete confirm modal */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[#e2e9e6] bg-white p-4">
            <p className="mb-1 text-sm font-bold text-[#0a3f35]">রেকর্ড মুছে ফেলবেন?</p>
            <p className="mb-4 text-sm text-[#5b6f6b]">
              এই রেকর্ডটি স্থায়ীভাবে মুছে যাবে। এই কাজটি ফিরিয়ে নেওয়া যাবে না।
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-xl border border-[#e2e9e6] py-3 text-sm font-semibold text-[#5b6f6b] transition active:scale-[0.98]"
              >
                বাতিল
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
              >
                {deleting ? "মুছে ফেলা হচ্ছে…" : "মুছে ফেলুন"}
              </button>
            </div>
          </div>
        </div>
      )}

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