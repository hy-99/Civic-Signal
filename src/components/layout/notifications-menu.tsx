"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ReportCardView } from "@/lib/types";

type Tone = "urgent" | "info" | "ok" | "watch";

type Notification = {
  id: string;
  tone: Tone;
  icon: string;
  title: string;
  detail: string;
  href?: string;
  created_at?: string;
};

const DUMMY_NOTIFICATIONS: Notification[] = [
  {
    id: "n1",
    tone: "urgent",
    icon: "🔥",
    title: "Urgent: Smoke spotted near Embarcadero",
    detail: "3 confirmations · 2m ago",
  },
  {
    id: "n2",
    tone: "ok",
    icon: "✓",
    title: "Your report was AI-verified",
    detail: "Broken glass · Dolores Park · 8m ago",
  },
  {
    id: "n3",
    tone: "watch",
    icon: "⚠",
    title: "New watch-level hazard nearby",
    detail: "Castro & Market · 12m ago",
  },
];

function toneForReport(report: ReportCardView): Tone {
  if (report.status === "verified" || report.status === "resolved") return "ok";
  if (report.risk_level === "urgent" || report.risk_level === "serious") return "urgent";
  if (report.risk_level === "watch") return "watch";
  return "info";
}

function iconForTone(tone: Tone): string {
  if (tone === "urgent") return "🔥";
  if (tone === "watch") return "⚠";
  if (tone === "ok") return "✓";
  return "📍";
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(then)) return "just now";
  const sec = Math.max(1, Math.floor(diff / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function reportToNotification(report: ReportCardView): Notification {
  const tone = toneForReport(report);
  const place = report.address_text?.trim() || "Location pending";
  return {
    id: `report:${report.id}`,
    tone,
    icon: iconForTone(tone),
    title: report.title,
    detail: `${place} · ${relativeTime(report.created_at)}`,
    href: `/app/reports/${report.id}`,
    created_at: report.created_at,
  };
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>(DUMMY_NOTIFICATIONS);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/reports", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { ok: boolean; data?: ReportCardView[] };
      if (!payload.ok || !payload.data) return;
      const recent = [...payload.data]
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
        .slice(0, 5)
        .map(reportToNotification);
      setItems([...recent, ...DUMMY_NOTIFICATIONS]);
    } catch {
      // Network failures fall back to whatever is already displayed.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (cancelled) return;
    })();
    const onPublished = () => {
      void refresh();
    };
    window.addEventListener("civicsignal:report-published", onPublished);
    return () => {
      cancelled = true;
      window.removeEventListener("civicsignal:report-published", onPublished);
    };
  }, [refresh]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = () => {
    setOpen((value) => {
      const next = !value;
      if (next) void refresh();
      return next;
    });
  };

  const unread = items.length;

  return (
    <div className="cs-notif" ref={ref}>
      <button
        type="button"
        className="cs-notif__btn"
        aria-label={`Notifications (${unread} unread)`}
        aria-expanded={open}
        onClick={toggle}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? <span className="cs-notif__badge">{unread}</span> : null}
      </button>

      {open ? (
        <div className="cs-notif__panel" role="dialog" aria-label="Notifications">
          <div className="cs-notif__header">
            <h3>Notifications</h3>
            <span>{unread} new</span>
          </div>
          <ul className="cs-notif__list">
            {items.map((notification) => {
              const body = (
                <>
                  <span className={`cs-notif__icon cs-notif__icon--${notification.tone}`} aria-hidden="true">
                    {notification.icon}
                  </span>
                  <div className="cs-notif__body">
                    <p>{notification.title}</p>
                    <p>{notification.detail}</p>
                  </div>
                </>
              );
              return (
                <li key={notification.id} className="cs-notif__item">
                  {notification.href ? (
                    <Link href={notification.href} className="cs-notif__row" onClick={() => setOpen(false)}>
                      {body}
                    </Link>
                  ) : (
                    <div className="cs-notif__row">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
