"use client";

import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Notification = {
  id: string;
  tone: "urgent" | "info" | "ok" | "watch";
  icon: string;
  title: string;
  detail: string;
};

const NOTIFICATIONS: Notification[] = [
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

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = NOTIFICATIONS.length;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="cs-notif" ref={ref}>
      <button
        type="button"
        className="cs-notif__btn"
        aria-label={`Notifications (${unread} unread)`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
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
            {NOTIFICATIONS.map((notification) => (
              <li key={notification.id} className="cs-notif__item">
                <span className={`cs-notif__icon cs-notif__icon--${notification.tone}`} aria-hidden="true">
                  {notification.icon}
                </span>
                <div className="cs-notif__body">
                  <p>{notification.title}</p>
                  <p>{notification.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
