import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NetSettle — Intercompany Netting on Canton",
  description: "Compress intercompany payable cycles and settle the residual atomically on Canton.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="wrap">
          <header className="topbar">
            <div className="brand">
              NET<span>SETTLE</span>
            </div>
            <nav className="nav">
              <a href="/">Ingest</a>
              <a href="/review">Review</a>
              <a href="/proposal">Proposal</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
