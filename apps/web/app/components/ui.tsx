import type { ReactNode } from "react";

export function Kicker({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-mint">
      {children}
    </p>
  );
}

export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const labels = ["Ingest obligations", "Review ambiguities", "Propose & settle"];
  return (
    <ol className="mb-10 mt-2 flex gap-3">
      {labels.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const now = n === current;
        return (
          <li
            key={label}
            className={`flex-1 border-t-2 pt-2.5 text-[13px] ${
              done
                ? "border-mint text-mint"
                : now
                  ? "border-gold text-text"
                  : "border-line text-faint"
            }`}
          >
            <span className="tnum mr-1.5 font-mono">{n}</span>
            {label}
          </li>
        );
      })}
    </ol>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "ok" | "bad";
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-line text-mist",
    ok: "border-mint/40 bg-mint/10 text-mint",
    bad: "border-rose/40 bg-rose/10 text-rose",
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`card-sheen rounded-2xl border border-line bg-gradient-to-b from-panel2 to-panel p-6 sm:p-7 ${className}`}
    >
      {children}
    </div>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  return tone === "error" ? (
    <div className="my-4 rounded-xl border border-rose/35 bg-rose/10 px-4 py-3 text-sm text-rose">
      {children}
    </div>
  ) : (
    <div className="my-4 rounded-xl border border-mint/35 bg-mint/10 px-4 py-3 text-sm text-mint">
      {children}
    </div>
  );
}
