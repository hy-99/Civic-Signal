"use client";

import { useEffect, useState } from "react";
import { Radar } from "lucide-react";

import { BrandWordmark } from "@/components/shared/brand";

export const OVERLAY_DURATION_MS = 1700;
const EXIT_AT_MS = 1500;

type SignalPin = {
  left: string;
  top: string;
  color: string;
  delay: number;
  district: string;
  score?: number;
};

const SIGNAL_PINS: SignalPin[] = [
  { left: "12%", top: "22%", color: "#ef4444", delay: 0, district: "EMBARCADERO", score: 82 },
  { left: "26%", top: "66%", color: "#eab308", delay: 90, district: "MISSION", score: 47 },
  { left: "38%", top: "14%", color: "#f97316", delay: 180, district: "FILLMORE", score: 63 },
  { left: "64%", top: "78%", color: "#ef4444", delay: 270, district: "BAYVIEW", score: 78 },
  { left: "78%", top: "26%", color: "#f97316", delay: 360, district: "CASTRO" },
  { left: "18%", top: "48%", color: "#eab308", delay: 450, district: "RICHMOND" },
  { left: "86%", top: "58%", color: "#94a3b8", delay: 540, district: "SUNSET" },
  { left: "52%", top: "88%", color: "#f97316", delay: 630, district: "EXCELSIOR" },
];

const STATUS_MESSAGES = [
  "Connecting to your city",
  "Receiving citizen signals",
  "AI evaluating risk",
  "Live map ready",
];

export function LaunchOverlay() {
  const [signalCount, setSignalCount] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    let n = 0;
    const id = window.setInterval(() => {
      n += Math.floor(Math.random() * 9) + 4;
      if (n >= 247) {
        n = 247;
        window.clearInterval(id);
      }
      setSignalCount(n);
    }, 38);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setMessageIndex(1), 360),
      window.setTimeout(() => setMessageIndex(2), 760),
      window.setTimeout(() => setMessageIndex(3), 1180),
      window.setTimeout(() => setExiting(true), EXIT_AT_MS),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  return (
    <div
      aria-hidden="true"
      data-exiting={exiting ? "true" : "false"}
      className="cs-launch fixed inset-0 z-[60] overflow-hidden text-white"
    >
      <div className="cs-launch__bg" />
      <div className="cs-launch__grid" />

      <div className="cs-launch__radar-wrap">
        <div className="cs-launch__radar-ring cs-launch__radar-ring--1" />
        <div className="cs-launch__radar-ring cs-launch__radar-ring--2" />
        <div className="cs-launch__radar-ring cs-launch__radar-ring--3" />
        <div className="cs-launch__radar-sweep" />
        <div className="cs-launch__radar-axis cs-launch__radar-axis--h" />
        <div className="cs-launch__radar-axis cs-launch__radar-axis--v" />
      </div>

      <svg
        className="cs-launch__lines"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {SIGNAL_PINS.map((pin, index) => {
          const x1 = parseFloat(pin.left);
          const y1 = parseFloat(pin.top);
          return (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2="50"
              y2="50"
              stroke={pin.color}
              strokeWidth="0.18"
              strokeLinecap="round"
              className="cs-launch__line"
              style={{ animationDelay: `${pin.delay + 280}ms` }}
            />
          );
        })}
      </svg>

      {SIGNAL_PINS.map((pin, index) => (
        <div
          key={index}
          className="cs-launch__pin"
          style={{
            left: pin.left,
            top: pin.top,
            ["--cs-color" as string]: pin.color,
            animationDelay: `${pin.delay}ms`,
          }}
        >
          <svg width="26" height="33" viewBox="0 0 36 46" aria-hidden="true" className="cs-launch__pin-svg">
            <path
              d="M18 1 C8.6 1 1 8.6 1 18 C1 30 18 45 18 45 C18 45 35 30 35 18 C35 8.6 27.4 1 18 1 Z"
              fill={pin.color}
              stroke="white"
              strokeWidth="2"
            />
            <circle cx="18" cy="18" r="6" fill="white" />
          </svg>
          <span className="cs-launch__pin-pulse" style={{ animationDelay: `${pin.delay + 240}ms` }} />
          {pin.score !== undefined ? (
            <span
              className="cs-launch__pin-score"
              style={{ animationDelay: `${pin.delay + 380}ms` }}
            >
              {pin.score}
            </span>
          ) : null}
          <span
            className="cs-launch__pin-district"
            style={{ animationDelay: `${pin.delay + 240}ms` }}
          >
            {pin.district}
          </span>
        </div>
      ))}

      <div className="cs-launch__center">
        <div className="cs-launch__logo">
          <Radar className="h-9 w-9 text-[#ffd84d]" />
        </div>
        <BrandWordmark variant="hero" className="cs-launch__wordmark" />
        <p key={messageIndex} className="cs-launch__tag">
          {STATUS_MESSAGES[messageIndex]}
          <span className="cs-launch__caret" aria-hidden="true" />
        </p>
        <div className="cs-launch__counter">
          <span className="cs-launch__counter-num">{signalCount.toString().padStart(3, "0")}</span>
          <span className="cs-launch__counter-dot" />
          <span className="cs-launch__counter-label">Signals received</span>
        </div>
        <p className="cs-launch__sub">AI-evaluating risk in real time</p>
      </div>

      <div className="cs-launch__scan" />
      <div className="cs-launch__shock" />
    </div>
  );
}
