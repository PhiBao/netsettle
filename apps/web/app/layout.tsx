import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NetSettle — Intercompany netting on Canton",
    template: "%s · NetSettle",
  },
  description:
    "Compress intercompany payable cycles into net settlements, commit them in one atomic Canton transaction, and hand the treasury a bank-ready payment file.",
  metadataBase: new URL("https://100-30-125-235.nip.io"),
  openGraph: {
    title: "NetSettle — Intercompany netting on Canton",
    description: "$312,000 gross across 6 invoices becomes $40,000 net in 3 atomic transfers.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NetSettle — Intercompany netting on Canton",
    description: "$312,000 gross becomes $40,000 net in 3 atomic transfers.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="font-body">
        <div className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
          <header className="flex items-center justify-between border-b border-line py-5">
            <a href="/" className="flex items-center gap-2.5 no-underline">
              <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden="true">
                <rect width="64" height="64" rx="14" fill="#0e1420" />
                <g fill="none" stroke="#34d399" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M32 12 L48 40 L16 40 Z" />
                </g>
                <circle cx="32" cy="12" r="4" fill="#f5c518" />
                <circle cx="48" cy="40" r="4" fill="#34d399" />
                <circle cx="16" cy="40" r="4" fill="#e9eef6" />
              </svg>
              <span className="font-display text-[15px] font-bold tracking-[0.08em] text-text">
                NET<span className="text-mint">SETTLE</span>
              </span>
            </a>
            <nav className="flex items-center gap-2 text-sm">
              <a href="/" className="rounded-lg px-3 py-1.5 text-mist no-underline transition hover:bg-panel2 hover:text-text">
                Ingest
              </a>
              <a href="/review" className="rounded-lg px-3 py-1.5 text-mist no-underline transition hover:bg-panel2 hover:text-text">
                Review
              </a>
              <a href="/proposal" className="rounded-lg px-3 py-1.5 text-mist no-underline transition hover:bg-panel2 hover:text-text">
                Proposal
              </a>
            </nav>
          </header>
          {children}
          <footer className="mt-20 flex flex-col gap-2 border-t border-line pt-6 text-[13px] text-faint sm:flex-row sm:items-center sm:justify-between">
            <span>
              NetSettle · multilateral intercompany netting on Canton Network
            </span>
            <span className="tnum">
              gross → net, atomically ·{" "}
              <a
                href="https://github.com/PhiBao/netsettle"
                className="text-mist underline decoration-line underline-offset-4 hover:text-text"
              >
                open source (MIT)
              </a>
            </span>
          </footer>
        </div>
      </body>
    </html>
  );
}
