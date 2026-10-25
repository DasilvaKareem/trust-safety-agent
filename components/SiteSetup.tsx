import { useState } from 'react';
import Link from 'next/link';
import type { Site } from '@/lib/account/sites';
export async function siteRequest(id: string, action: string, extra: Record<string, unknown> = {}) {
  const response = await fetch(`/api/sites/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...extra }) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Please try again.'); return data.site as Site;
}
export default function SiteSetup({ site, onChange, schedulerReady, onMessage }: { site: Site; onChange: (site: Site) => void; schedulerReady: boolean; onMessage: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function act(action: string, extra = {}) {
    setBusy(true); onMessage(action === 'verify' ? 'I’m checking your verification file now…' : 'I’m updating your monitoring settings…');
    try { onChange(await siteRequest(site.id, action, extra)); onMessage(''); } catch (e) { onMessage(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); }
  }
  const file = `trust-safety-verification=${site.verificationToken}`;
  if (site.kind === 'vercel' && !site.verifiedAt) return <div className="site-setup"><Link className="flow-primary" href="/onboarding?step=connect">Reconnect Vercel →</Link></div>;
  return <div className="site-setup">
    {site.kind === 'website' && !site.verifiedAt ? <>
      <label className="field-label">File URL</label><code className="copy-block">{new URL(site.url).origin}/.well-known/trust-safety.txt</code>
      <label className="field-label">File contents</label><code className="copy-block">{file}</code>
      <div className="flow-actions"><a className="flow-secondary" download="trust-safety.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(file)}`}>Download file ↓</a><button className="flow-primary" disabled={busy} onClick={() => act('verify')}>{busy ? 'Checking…' : 'Check verification'}</button></div>
    </> : <>
      <span className="verified-label">✓ Ownership verified{site.kind === 'vercel' ? ' through Vercel' : ''}</span>
      <button className="flow-primary" disabled={busy || (!site.monitoring && site.kind === 'website' && !schedulerReady)} onClick={() => act('monitor', { enabled: !site.monitoring })}>{busy ? 'Saving…' : site.monitoring ? 'Pause monitoring' : 'Enable monitoring'}</button>
    </>}
  </div>;
}
