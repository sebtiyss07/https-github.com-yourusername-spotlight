"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CityInput } from "@/components/CityInput";

interface Pick {
  kind: "team" | "league";
  id: string;
  title: string;
  subtitle: string;
}

const BUDGETS = [0, 200, 300, 500, 800, 1200];

/**
 * The home page's main tool: who you want to see, where you're coming from
 * and a budget, then every whole trip (ticket + hotel + flight) priced on
 * /trips. Typing a team without picking one uses the top suggestion.
 */
export function TripPlanner({ currencySymbol }: { currencySymbol: string }) {
  const router = useRouter();
  const [who, setWho] = useState("");
  const [pick, setPick] = useState<Pick | null>(null);
  const [items, setItems] = useState<Pick[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [from, setFrom] = useState("");
  const [budget, setBudget] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const close = (e: PointerEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  useEffect(() => {
    const q = who.trim();
    if (q.length < 2 || (pick && pick.title === who)) return setItems([]);
    const t = setTimeout(() => {
      fetch(`/api/suggest?only=places&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { items: Pick[] }) => setItems(d.items))
        .catch(() => setItems([]));
    }, 140);
    return () => clearTimeout(t);
  }, [who, pick]);

  const choose = (p: Pick) => {
    setPick(p);
    setWho(p.title);
    setOpen(false);
  };

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const chosen = pick ?? (who.trim() ? items[0] : undefined);
    const q = new URLSearchParams();
    if (chosen) q.set(chosen.kind, chosen.id);
    if (from.trim()) q.set("from", from.trim());
    q.set("budget", String(budget));
    router.push(`/trips?${q}`);
  };

  const field = "block rounded-xl bg-surface-2 px-4 py-2.5 text-left ring-1 ring-line focus-within:ring-2 focus-within:ring-accent";
  const label = "block text-[12px] font-semibold text-ink-3";
  const input = "w-full bg-transparent text-[16px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-3";

  return (
    <form onSubmit={go} className="rounded-2xl bg-surface p-3 text-ink shadow-xl sm:p-4">
      <div className="grid gap-2 sm:grid-cols-[1.4fr_1.2fr_0.9fr]">
        <div ref={wrap} className="relative">
          <label className={field}>
            <span className={label}>Who do you want to see?</span>
            <input
              value={who}
              onChange={(e) => {
                setWho(e.target.value);
                setPick(null);
                setOpen(true);
                setActive(-1);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={(e) => {
                if (!open || !items.length) return;
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => (i + 1) % items.length);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
                } else if (e.key === "Enter" && active >= 0) {
                  e.preventDefault();
                  choose(items[active]);
                } else if (e.key === "Escape") setOpen(false);
              }}
              placeholder="A team or league, e.g. Lakers"
              autoComplete="off"
              role="combobox"
              aria-expanded={open && items.length > 0}
              aria-controls={listId}
              className={input}
            />
          </label>
          {open && items.length > 0 && (
            <ul id={listId} role="listbox" className="absolute left-0 top-full z-50 mt-2 w-full min-w-[260px] rounded-2xl border border-line bg-surface p-1.5 shadow-lg">
              {items.map((p, i) => (
                <li key={`${p.kind}-${p.id}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onClick={() => choose(p)}
                    onMouseEnter={() => setActive(i)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${i === active ? "bg-surface-2" : ""}`}
                  >
                    <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-[15px]">
                      {p.kind === "team" ? "🏟️" : "🏆"}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold">{p.title}</span>
                      <span className="block truncate text-[13px] text-ink-3">{p.subtitle}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={field}>
          <span className={label}>From</span>
          <CityInput
            name="from"
            onValueChange={setFrom}
            placeholder="Your city"
            ariaLabel="Travelling from"
            inputClassName={input}
          />
        </div>

        <label className={field}>
          <span className={label}>Budget per person</span>
          <select value={budget} onChange={(e) => setBudget(Number(e.target.value))} className={`${input} cursor-pointer`}>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                {b ? `Under ${currencySymbol}${b.toLocaleString("en-US")}` : "Any budget"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="submit"
        className="mt-3 w-full rounded-xl bg-sun px-5 py-3.5 text-[17px] font-extrabold text-ink transition-colors hover:bg-[#ffd666]"
      >
        Price my whole trip →
      </button>
      <p className="mt-2 text-center text-[13px] text-ink-3">Ticket + hotel + flight, one total. Free, no sign-up.</p>
    </form>
  );
}
