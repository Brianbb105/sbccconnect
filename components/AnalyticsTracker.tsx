'use client';

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TRACK_ENDPOINT = "/api/track";

function sendTrackEvent(event: string, path: string) {
  const body = JSON.stringify({
    event,
    path,
    ts: Date.now(),
  });

  if (typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(TRACK_ENDPOINT, blob);
    return;
  }

  void fetch(TRACK_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Ignore analytics network failures.
  });
}

function normalizeEventLabel(value: string): string {
  return value.trim().replace(/\s+/g, "_").toLowerCase().slice(0, 80);
}

function getEventName(element: HTMLElement): string | null {
  if (element.dataset.track) {
    return normalizeEventLabel(element.dataset.track);
  }

  if (element instanceof HTMLAnchorElement) {
    const href = element.getAttribute("href");
    if (!href) {
      return "link_click";
    }
    return normalizeEventLabel(`link:${href}`);
  }

  if (element instanceof HTMLButtonElement) {
    const label = element.getAttribute("aria-label") || element.textContent || "button";
    return normalizeEventLabel(`button:${label}`);
  }

  return null;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const query = window.location.search;
    const pathWithQuery = query ? `${pathname}${query}` : pathname;
    sendTrackEvent("page_view", pathWithQuery);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const clickable = target.closest<HTMLElement>("[data-track],a,button");
      if (!clickable) {
        return;
      }

      const eventName = getEventName(clickable);
      if (!eventName) {
        return;
      }

      sendTrackEvent(eventName, pathname);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
    };
  }, [pathname]);

  return null;
}
