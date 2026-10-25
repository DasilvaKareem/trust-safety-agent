import Head from 'next/head';
import Link from 'next/link';
import type { ReactNode } from 'react';

export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <div className="legal-page"><Head><title>{title} · Argon Guard</title><meta name="robots" content="noindex" /></Head>
    <header><Link href="/">✦ Argon Guard</Link><Link href="/support">Contact support ↗</Link></header>
    <main><span className="legal-eyebrow">ARGON GUARD · TRUST CENTER</span><h1>{title}</h1>
      <p className="legal-draft">Effective October 25, 2026 · Hackathon preview</p>
      {children}
    </main>
    <footer><Link href="/terms">Terms of use</Link><Link href="/privacy">Privacy policy</Link><Link href="/support">Support</Link></footer>
  </div>;
}
