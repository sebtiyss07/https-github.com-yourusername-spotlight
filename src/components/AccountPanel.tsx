"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

/**
 * On "My games": signed out, why to sign in; signed in, the price-drop email
 * switch. Emails are off until the person turns them on.
 */
export function AccountPanel() {
  const { isLoaded, isSignedIn } = useAuth();
  const [alerts, setAlerts] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { alerts: boolean } | null) => setAlerts(d ? d.alerts : false))
      .catch(() => setAlerts(false));
  }, [isSignedIn]);

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/[0.05] p-4 sm:flex-row sm:items-center">
        <p className="flex-1 text-[15px] text-ink-2">
          <span className="font-semibold text-ink">Sign in to keep your games on every device</span> and get an email
          when one gets cheaper. No password: we email you a code.
        </p>
        <SignInButton mode="modal">
          <button type="button" className="shrink-0 rounded-xl bg-accent px-5 py-2.5 font-bold text-white hover:bg-accent-2">
            Sign in or create an account
          </button>
        </SignInButton>
      </div>
    );
  }

  const toggle = async () => {
    if (alerts === null) return;
    const next = !alerts;
    setSaving(true);
    const ok = await fetch("/api/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alerts: next }),
    })
      .then((r) => r.ok)
      .catch(() => false);
    if (ok) setAlerts(next);
    setSaving(false);
  };

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-xs">
      <div className="flex-1">
        <p className="text-[15px] font-semibold">Email me when a saved game gets cheaper</p>
        <p className="text-[13px] text-ink-3">
          One email when the cheapest price with fees included drops, checked daily. Unsubscribe with one click.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={alerts === true}
        aria-label="Price-drop emails"
        disabled={alerts === null || saving}
        onClick={toggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${alerts ? "bg-positive" : "bg-surface-3"}`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${alerts ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}
