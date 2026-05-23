"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, MapPin, ShieldCheck } from "lucide-react";

import { APP_DESCRIPTION, APP_TAGLINE } from "@/lib/constants";
import { LaunchButton } from "@/components/marketing/launch-button";
import { LaunchOverlay, OVERLAY_DURATION_MS } from "@/components/marketing/launch-overlay";
import { SiteHeader } from "@/components/layout/site-header";
import { BrandWordmark } from "@/components/shared/brand";

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

const LANDING_EXIT_MS = 760;

type LaunchPhase = "idle" | "exiting" | "overlay";

export function LandingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<LaunchPhase>("idle");
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    router.prefetch("/app/map");
  }, [router]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  const start = () => {
    if (phase !== "idle") return;
    setPhase("exiting");
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    const overlayTimer = window.setTimeout(() => setPhase("overlay"), LANDING_EXIT_MS);
    const navTimer = window.setTimeout(() => {
      router.push("/app/map");
    }, LANDING_EXIT_MS + OVERLAY_DURATION_MS);
    timersRef.current = [overlayTimer, navTimer];
  };

  return (
    <div className="cs-landing" data-launch-phase={phase}>
      <div className="cs-landing__header">
        <SiteHeader />
      </div>
      <main className="bg-[#eef3f8]">
      <section className="civic-hero-surface relative overflow-hidden px-5 py-12 text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.18)] md:px-8 lg:min-h-[calc(100vh-73px)] lg:px-12 lg:py-0">
        <div className="cs-landing__veil" aria-hidden="true" />
        <div className="mx-auto grid h-full max-w-[1360px] gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center">
          <div className="max-w-[620px] py-8 lg:py-16">
            <div className="cs-landing__eyebrow inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-2">
              <BrandWordmark variant="hero" />
            </div>

            <h1 className="cs-landing__title mt-8 text-5xl font-black uppercase leading-[0.9] tracking-[-0.05em] text-white drop-shadow-sm sm:text-6xl lg:text-7xl">
              <span className="block">Spot it.</span>
              <span className="block text-[#ffd84d]">Verify it.</span>
              <span className="block">Prioritize it.</span>
            </h1>

            <p className="cs-landing__sub mt-7 max-w-xl text-lg leading-8 text-blue-50/88">
              {APP_TAGLINE} Publish hazards with a title, location, and photo evidence so nearby people know what to avoid and responders can see what needs action.
            </p>

            <div className="cs-landing__cta mt-8 flex flex-wrap gap-3">
              <LaunchButton onLaunch={start} disabled={phase !== "idle"} />
              <Link
                href="/app/submit"
                className="inline-flex items-center gap-2 rounded-xl border border-white/45 bg-white/8 px-6 py-4 text-sm font-black text-white transition hover:bg-white/14"
              >
                Submit a Report
              </Link>
            </div>

            <div className="cs-landing__stats mt-10 grid max-w-xl grid-cols-3 gap-5">
              {[
                ["34", "Mapped areas"],
                ["24+", "Public signals"],
                ["Live", "Hazard map"],
              ].map(([value, label]) => (
                <div key={label}>
                  <p className="text-3xl font-black tracking-[-0.04em] text-[#ffd84d] sm:text-4xl">{value}</p>
                  <p className="mt-1 text-xs font-semibold text-blue-50/78 sm:text-sm">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="cs-landing__card-wrap relative min-h-[430px] py-8 lg:min-h-[620px]">
            <div className="cs-landing__chip-yellow absolute right-[8%] top-[8%] rounded-full bg-[#ffd84d] px-4 py-2 text-sm font-black text-slate-950 shadow-[0_18px_34px_rgba(0,0,0,0.2)]">
              +12 new signals
            </div>
            <div className="cs-landing__chip-green absolute bottom-[11%] left-[7%] rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-white shadow-[0_18px_34px_rgba(0,0,0,0.18)]">
              Verification active
            </div>

            <div className="cs-landing__card absolute left-1/2 top-1/2 w-[min(640px,94vw)] -translate-x-1/2 -translate-y-1/2 rotate-2 rounded-[1.6rem] border border-white/35 bg-white p-5 text-slate-950 shadow-[0_34px_92px_rgba(8,20,74,0.34)] md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">CivicSignal preview</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Recent reports</h2>
                </div>
                <div className="flex gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-300" />
                  <span className="h-3 w-3 rounded-full bg-amber-300" />
                  <span className="h-3 w-3 rounded-full bg-emerald-300" />
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {[
                  ["Broken glass near playground path", "Screenshot evidence submitted", "Serious", "text-rose-600"],
                  ["Flooding near school crosswalk", "Needs careful verification", "Watch", "text-amber-600"],
                  ["Road hazard by transit stop", "2 confirmations nearby", "Verified", "text-emerald-600"],
                ].map(([title, meta, state, tone]) => (
                  <div key={title} className="cs-landing__report-row grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl bg-slate-50 px-4 py-4">
                    <MapPin className={`h-5 w-5 ${tone}`} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-950 sm:text-base">{title}</p>
                      <p className="mt-1 text-xs text-slate-500">{meta}</p>
                    </div>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white">{state}</span>
                  </div>
                ))}
              </div>

              <div className="cs-landing__confidence mt-5 grid gap-3 rounded-xl bg-blue-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-sm font-bold text-slate-950">Explainable confidence</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Risk and confidence stay separate so urgent but uncertain reports are clearly labeled.</p>
                </div>
                <div className="rounded-xl bg-[#2454d6] px-4 py-3 text-center text-white">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-100">Confidence</p>
                  <p className="text-3xl font-black">84</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="cs-landing__rest mx-auto grid max-w-[1360px] gap-6 px-5 py-8 md:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Why it exists</p>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-slate-950 md:text-4xl">Civic problems are visible, but the signals are scattered.</h2>
          <p className="mt-5 text-base leading-8 text-slate-600">{APP_DESCRIPTION}</p>
          <div className="mt-7 grid gap-4">
            {[
              ["Report", "Residents publish a hazard title, location, description, and photo or screenshot evidence."],
              ["Verify", "Community confirmations and public signals help separate real issues from false alarms."],
              ["Prioritize", "The map highlights dangerous areas so people can avoid them and responders can act faster."],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                <p className="font-bold text-slate-950">{title}</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-blue-700" />
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">How CivicSignal works</p>
            </div>
            <div className="mt-6 grid gap-3">
              {[
                "Someone witnesses a hazard and submits a place-based report with evidence.",
                "CivicSignal captures category, location, time, confidence, and supporting context.",
                "Related reports and public signals are grouped into a map cluster.",
                "The system scores risk and confidence with explainable factors.",
                "Residents, moderators, and civic responders verify, resolve, or update the issue.",
              ].map((step, index) => (
                <div key={step} className="grid grid-cols-[auto_1fr] gap-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2454d6] text-sm font-black text-white">{index + 1}</div>
                  <p className="pt-1 text-sm leading-7 text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Use cases</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {useCases.map((item) => (
                <span key={item} className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-slate-700">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="cs-landing__rest mx-auto max-w-[1360px] px-5 pb-10 md:px-8 lg:px-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm md:p-9">
          <div className="grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">Trust and safety</p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.04em] text-slate-950 md:text-4xl">Designed for places, hazards, and public conditions.</h2>
              <p className="mt-5 text-base leading-8 text-slate-600">
                CivicSignal does not score private people or make personal accusations. Reports are shown with confidence, evidence, status, and moderation paths so people can see what is known, uncertain, and still needs verification.
              </p>
            </div>
            <div className="grid gap-3">
              {[
                "Possible school-area concern reported near a public walkway. No private person is identified.",
                "Multiple signals indicate crowding risk near the library entrance after an event.",
                "High-risk or sensitive content can be held for moderator review before public display.",
              ].map((item) => (
                <div key={item} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
                  <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-600" />
                  <p className="text-sm leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      </main>
      {phase === "overlay" ? <LaunchOverlay /> : null}
    </div>
  );
}
