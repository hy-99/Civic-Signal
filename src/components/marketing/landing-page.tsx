"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  CheckCircle2,
  ArrowRight,
  Activity,
  Shield,
  Globe,
  Menu,
  X,
} from "lucide-react";

import { APP_DESCRIPTION } from "@/lib/constants";
import { LaunchOverlay, OVERLAY_DURATION_MS } from "@/components/marketing/launch-overlay";
import { BrandWordmark } from "@/components/shared/brand";

type RuntimeSplineApp = {
  load: (scene: string) => Promise<unknown>;
  dispose?: () => void;
};

function Spline({ scene, style }: { scene: string; style?: CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let app: RuntimeSplineApp | null = null;

    async function loadScene() {
      const { Application } = await import("@splinetool/runtime");
      if (cancelled || !canvasRef.current) return;
      const nextApp = new Application(canvasRef.current, { renderOnDemand: true });
      app = nextApp;
      await nextApp.load(scene);
    }

    void loadScene();

    return () => {
      cancelled = true;
      app?.dispose?.();
    };
  }, [scene]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="CivicSignal interactive 3D scene"
      className="block h-full w-full"
      style={style}
    />
  );
}

const useCases = [
  "Road hazards",
  "Flooding",
  "Fire / smoke",
  "Fallen trees",
  "Broken streetlights",
  "Sidewalk blockage",
  "Power outage",
  "Trash / sanitation",
  "Event crowding",
  "Weather damage",
  "School-area safety",
  "Public disturbance verification",
  "Crowd safety",
];

const LANDING_EXIT_MS = 680;
type LaunchPhase = "idle" | "exiting" | "overlay";

/* Stars removed — background is now pure black */

/* ================================================================ */

export function LandingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<LaunchPhase>("idle");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => { router.prefetch("/app/map"); }, [router]);
  useEffect(() => {
    return () => { timersRef.current.forEach((t) => window.clearTimeout(t)); timersRef.current = []; };
  }, []);

  const start = () => {
    if (phase !== "idle") return;
    setPhase("exiting");
    timersRef.current.forEach((t) => window.clearTimeout(t));
    const a = window.setTimeout(() => setPhase("overlay"), LANDING_EXIT_MS);
    const b = window.setTimeout(() => router.push("/app/map"), LANDING_EXIT_MS + OVERLAY_DURATION_MS);
    timersRef.current = [a, b];
  };

  const scroll = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    if (!id.startsWith("#")) return;
    e.preventDefault();
    document.getElementById(id.slice(1))?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  const NAV = [
    { label: "Why CivicSignal", id: "#why-exists" },
    { label: "How it Works",    id: "#how-it-works" },
    { label: "Use Cases",       id: "#use-cases" },
    { label: "Trust & Safety",  id: "#safety" },
  ];

  return (
    <div className="cs-landing min-h-screen bg-black text-white overflow-x-hidden font-sans selection:bg-violet-500/30" data-launch-phase={phase}>
      {/* ── BG (full viewport, purely visual, behind everything) ── */}
      <div className="pointer-events-none fixed inset-0 z-[1] overflow-hidden">
        <div style={{ width: "100%", height: "100%", transform: "scale(2)", transformOrigin: "center center" }}>
          <Spline
            scene="https://prod.spline.design/MT6TuRosOUJ9iepP/scene.splinecode"
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </div>
      </div>

      {/* ── Interactive Sphere — right side, shifted left ── */}
      <div className="fixed inset-y-0 right-0 z-[5] overflow-hidden" style={{ width: "53vw", pointerEvents: "auto" }}>
        <div style={{ width: "100%", height: "100%", transform: "scale(1.3)", transformOrigin: "center center" }}>
          <Spline
            scene="https://prod.spline.design/gswP1SFrmdXHmM9t/scene.splinecode"
            style={{ width: "100%", height: "100%", display: "block" }}
          />
        </div>
      </div>

      {/* ── header ── */}
      <header className="sticky top-0 z-50 w-full px-4 py-3.5 md:px-8" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 100%)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          <Link href="/" className="z-50 inline-flex items-center">
            <BrandWordmark variant="hero" className="opacity-90 hover:opacity-100 transition" />
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl px-1.5 py-1 transition duration-300 hover:bg-white/[0.04] hover:border-white/[0.1] shadow-[0_4px_30px_rgba(0,0,0,0.55)]">
            {NAV.map((n) => (
              <a key={n.id} href={n.id} onClick={(e) => scroll(e, n.id)}
                className="rounded-full px-3.5 py-1.5 text-[11px] font-medium text-slate-300/90 transition hover:text-white">{n.label}</a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <Link href="/app/map" className="text-[11px] font-medium text-slate-400 transition hover:text-white">Login</Link>
            <button onClick={start} disabled={phase !== "idle"}
              className="rounded-full border border-violet-500/35 bg-violet-600 px-4.5 py-1.5 text-[11px] font-semibold text-white shadow-[0_0_14px_rgba(124,58,237,0.3)] transition hover:bg-violet-500 hover:shadow-[0_0_22px_rgba(124,58,237,0.5)] active:scale-95 disabled:opacity-50">
              Launch Dashboard
            </button>
          </div>

          <button className="z-50 p-2 text-slate-400 hover:text-white transition md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-[#020008]/98 backdrop-blur-2xl px-6">
            {NAV.map((n) => (
              <a key={n.id} href={n.id} onClick={(e) => scroll(e, n.id)}
                className="border-b border-white/5 py-2 text-lg font-semibold text-slate-300 hover:text-white transition">{n.label}</a>
            ))}
            <div className="mt-6 flex flex-col gap-3 w-56">
              <Link href="/app/map" className="rounded-full border border-white/10 py-2.5 text-center text-sm font-medium text-slate-300 hover:text-white transition">Login</Link>
              <button onClick={start} className="rounded-full bg-violet-600 py-2.5 text-sm font-bold text-white">Launch Dashboard</button>
            </div>
          </div>
        )}
      </header>

      {/* ─── main ────────────────────────────────────────────── */}
      <main className="relative">

        {/* ══ hero ══════════════════════════════════════════════ */}
        <section className="relative flex min-h-[calc(100vh-60px)] flex-col items-center justify-end overflow-hidden px-5 pb-[18vh] sm:pb-[20vh]">

          {/* ── Spline 3D robot (left 62.5%, interactive, above BG) ── */}
          <div id="spline-slot" className="absolute top-0 bottom-0 left-0 z-[5]" style={{ width: "62.5%", pointerEvents: "auto" }}>
            <Spline scene="https://prod.spline.design/G6Ni0wPVm08EDyPb/scene.splinecode" />
          </div>

          {/* ── twinkling stars (right side) ── */}
          <div className="pointer-events-none absolute inset-0 z-[1]">
            {[
              { x: "62%", y: "8%",  s: 1.5, o: 0.4,  a: "cs-twinkle-a 4s ease-in-out infinite" },
              { x: "66%", y: "25%", s: 1,   o: 0.25, a: "cs-twinkle-b 5.5s ease-in-out 1s infinite" },
              { x: "70%", y: "48%", s: 1.5, o: 0.3,  a: "cs-twinkle-c 6s ease-in-out infinite" },
              { x: "64%", y: "72%", s: 1,   o: 0.2,  a: "cs-twinkle-a 7s ease-in-out 2s infinite" },
              { x: "74%", y: "12%", s: 2,   o: 0.45, a: "cs-twinkle-c 4.5s ease-in-out infinite" },
              { x: "78%", y: "35%", s: 1,   o: 0.22, a: "cs-twinkle-b 6.5s ease-in-out 0.5s infinite" },
              { x: "72%", y: "60%", s: 1,   o: 0.3,  a: "cs-twinkle-a 5s ease-in-out 1.5s infinite" },
              { x: "82%", y: "5%",  s: 1,   o: 0.35, a: "cs-twinkle-b 5s ease-in-out infinite" },
              { x: "86%", y: "28%", s: 1.5, o: 0.28, a: "cs-twinkle-c 7s ease-in-out 3s infinite" },
              { x: "80%", y: "52%", s: 1,   o: 0.2,  a: "cs-twinkle-a 6s ease-in-out infinite" },
              { x: "84%", y: "78%", s: 1,   o: 0.25, a: "cs-twinkle-b 5.5s ease-in-out 2s infinite" },
              { x: "90%", y: "15%", s: 1,   o: 0.32, a: "cs-twinkle-a 4.8s ease-in-out 0.8s infinite" },
              { x: "88%", y: "42%", s: 1.5, o: 0.18, a: "cs-twinkle-c 6.5s ease-in-out infinite" },
              { x: "92%", y: "65%", s: 1,   o: 0.22, a: "cs-twinkle-b 4s ease-in-out 1.2s infinite" },
              { x: "94%", y: "8%",  s: 1,   o: 0.38, a: "cs-twinkle-a 5.5s ease-in-out infinite" },
              { x: "96%", y: "50%", s: 1,   o: 0.15, a: "cs-twinkle-c 7.5s ease-in-out 2.5s infinite" },
              { x: "68%", y: "88%", s: 1.5, o: 0.2,  a: "cs-twinkle-b 4.5s ease-in-out infinite" },
              { x: "76%", y: "92%", s: 1,   o: 0.18, a: "cs-twinkle-a 6s ease-in-out 1s infinite" },
              { x: "91%", y: "82%", s: 1,   o: 0.25, a: "cs-twinkle-c 5s ease-in-out infinite" },
              { x: "65%", y: "40%", s: 1,   o: 0.15, a: "cs-twinkle-b 6.8s ease-in-out 3.5s infinite" },
            ].map((s, i) => (
              <span key={i} className="absolute block rounded-full bg-white"
                style={{ left: s.x, top: s.y, width: `${s.s}px`, height: `${s.s}px`, opacity: s.o, animation: s.a }} />
            ))}
          </div>

          {/* ── centred text (pointer-events pass through to Spline) ── */}
          <div className="pointer-events-none relative z-20 flex flex-col items-center">
            {/* heading */}
            <h1 className="mt-7 max-w-[720px] text-center text-[1.85rem] font-semibold leading-[1.18] tracking-tight text-white sm:text-[2.6rem] md:text-[3.2rem] lg:text-[3.5rem]">
              Think smarter with CivicSignal
            </h1>

            {/* subtitle */}
            <p className="mt-4 max-w-[440px] text-center text-[12.5px] leading-relaxed text-slate-400/90 sm:text-[13.5px]">
              Never miss a hazard, signal, or civic incident.
            </p>

            {/* CTAs */}
            <div className="mt-6 flex items-center gap-3">
              <button onClick={start} disabled={phase !== "idle"}
                className="pointer-events-auto inline-flex items-center gap-2 rounded-xl border border-violet-500/25 bg-violet-600 px-5 py-2.5 text-[11px] font-semibold text-white shadow-[0_0_18px_rgba(124,58,237,0.3)] transition hover:bg-violet-500 hover:shadow-[0_0_28px_rgba(124,58,237,0.45)] active:scale-[0.97] disabled:opacity-50">
                Open Live Map <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <Link href="/app/submit"
                className="pointer-events-auto inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-5 py-2.5 text-[11px] font-medium text-slate-300 backdrop-blur-sm transition hover:bg-white/[0.05] hover:text-white active:scale-[0.97]">
                Submit a Report
              </Link>
            </div>
          </div>
        </section>

        {/* ══ why it exists ═════════════════════════════════════ */}
        <section id="why-exists" className="relative z-10 border-t border-white/[0.03] px-5 py-24"
          style={{ background: "linear-gradient(180deg, rgba(21,0,64,0.5) 0%, rgba(10,0,30,0.8) 100%)" }}>
          <div className="mx-auto max-w-[1080px]">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-400">Mission & Philosophy</span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Civic problems are visible, but the signals are scattered</h2>
              <p className="mt-4 text-xs leading-relaxed text-slate-400 sm:text-sm">{APP_DESCRIPTION}</p>
            </div>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {([
                { title: "1. Capture & Report", body: "Residents publish hazard locations, details, and photo evidence — documenting issues before they escalate.", icon: <Globe className="h-[18px] w-[18px] text-violet-400" /> },
                { title: "2. Triangulate & Verify", body: "Community confirmations and live feed scanning separate verified clusters from false alarms automatically.", icon: <Activity className="h-[18px] w-[18px] text-cyan-400" /> },
                { title: "3. Prioritize & Resolve", body: "The live map scores incidents separately for risk and confidence, highlighting urgent danger areas for responders.", icon: <Shield className="h-[18px] w-[18px] text-violet-400" /> },
              ]).map((c, i) => (
                <div key={i} className="group rounded-2xl border border-white/[0.04] bg-white/[0.01] p-7 backdrop-blur-sm transition duration-300 hover:border-violet-500/15 hover:bg-white/[0.02]">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] transition duration-300 group-hover:border-violet-500/20">{c.icon}</div>
                  <h3 className="mt-5 text-sm font-semibold text-white">{c.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ how it works ══════════════════════════════════════ */}
        <section id="how-it-works" className="relative z-10 border-t border-white/[0.03] px-5 py-24"
          style={{ background: "linear-gradient(180deg, rgba(10,0,30,0.8) 0%, rgba(6,0,20,0.9) 100%)" }}>
          <div className="mx-auto max-w-[880px]">
            <div className="mx-auto max-w-xl text-center">
              <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-400">Platform Blueprint</span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">How CivicSignal orchestrates response</h2>
            </div>
            <div className="mt-14 grid gap-4">
              {[
                "A resident witnesses a public hazard and submits a report with photo evidence.",
                "CivicSignal registers category, precise coordinates, time, and surrounding safety parameters.",
                "Deterministic and AI clustering algorithms combine related reports into managed incident groups.",
                "Explainable risk scoring separates uncertainty from danger, providing high-confidence triage.",
                "Residents track progress, moderators filter signals, and official responders act on resolved cases.",
              ].map((step, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr] items-start gap-5 rounded-xl border border-white/[0.03] bg-white/[0.008] p-5 transition duration-300 hover:border-violet-500/10 hover:bg-white/[0.015]">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-[10px] font-black text-white shadow-[0_0_10px_rgba(124,58,237,0.2)]">{i + 1}</div>
                  <p className="pt-0.5 text-xs leading-relaxed text-slate-300 sm:text-sm">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ use cases ═════════════════════════════════════════ */}
        <section id="use-cases" className="relative z-10 border-t border-white/[0.03] px-5 py-24"
          style={{ background: "linear-gradient(180deg, rgba(6,0,20,0.9) 0%, rgba(4,0,14,0.95) 100%)" }}>
          <div className="mx-auto max-w-[880px] text-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-violet-400">Hazards Covered</span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Comprehensive category tracking</h2>
            <p className="mx-auto mt-3 max-w-md text-xs text-slate-400 sm:text-sm">CivicSignal evaluates and structures a wide spectrum of citizen hazards and urban disturbances.</p>
            <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
              {useCases.map((u) => (
                <span key={u} className="cursor-default rounded-full border border-white/[0.05] bg-white/[0.01] px-4 py-1.5 text-[11px] font-medium text-slate-300 transition duration-200 hover:border-violet-400/20 hover:bg-white/[0.03] hover:text-white">{u}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ══ trust & safety ════════════════════════════════════ */}
        <section id="safety" className="relative z-10 border-t border-white/[0.03] px-5 pb-32 pt-24"
          style={{ background: "linear-gradient(180deg, rgba(4,0,14,0.95) 0%, rgba(2,0,8,1) 100%)" }}>
          <div className="mx-auto max-w-[1000px]">
            <div className="rounded-2xl border border-white/[0.04] bg-gradient-to-b from-white/[0.012] to-transparent p-8 backdrop-blur-sm shadow-[0_16px_48px_rgba(0,0,0,0.35)] md:p-10">
              <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
                <div className="lg:col-span-7">
                  <span className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-400">CaseOps Ethics</span>
                  <h2 className="mt-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">Designed for conditions, hazards, and infrastructure</h2>
                  <p className="mt-4 text-xs leading-relaxed text-slate-400 sm:text-sm">CivicSignal is dedicated purely to public conditions and hazard management. The platform does not profile individuals, track private citizens, or log personal identifiers. Risk and confidence scores remain strictly isolated so uncertain notifications are clearly highlighted for verification.</p>
                </div>
                <div className="grid gap-3 lg:col-span-5">
                  {["Focuses on school-area concerns, road obstacles, and public crowding safety.",
                    "Keeps risk assessments transparent using explainable, deterministic scoring indicators.",
                    "Sensitive reports containing personal context are routed to moderator approval queues.",
                  ].map((b, i) => (
                    <div key={i} className="flex gap-3 rounded-lg border border-white/[0.02] bg-white/[0.004] p-4 transition hover:border-violet-500/10">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                      <p className="text-[11px] font-medium leading-relaxed text-slate-300">{b}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {phase === "overlay" ? <LaunchOverlay /> : null}
    </div>
  );
}
