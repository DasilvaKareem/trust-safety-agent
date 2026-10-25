import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Site } from '@/lib/account/sites';
import ScanStatus from './ScanStatus';
import { siteRequest } from './SiteSetup';
export default function ConnectedSites({ initialSites }: { initialSites: Site[] }) {
  const [sites, setSites] = useState(initialSites); const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState('');
  useEffect(() => {
    if (!busy) return; let active = true;
    const timer = setInterval(async () => { const r = await fetch(`/api/sites/${busy}`); if (r.ok) { const data = await r.json(); if (active) setSites(old => old.map(s => s.id === busy ? data.site : s)); } }, 1500);
    return () => { active = false; clearInterval(timer); };
  }, [busy]);
  async function scan(site: Site) {
    setBusy(site.id); setError(''); setSites(old => old.map(s => s.id === site.id ? { ...s, scanState: 'fetching' } : s));
    try { const updated = await siteRequest(site.id, 'scan'); setSites(old => old.map(s => s.id === site.id ? updated : s)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Scan failed.'); setSites(old => old.map(s => s.id === site.id ? { ...s, scanState: 'error', error: 'Scan could not finish. Please try again.' } : s)); }
    finally { setBusy(null); }
  }
  async function disconnect(site: Site) {
    if (!window.confirm(`Disconnect ${site.name}? Monitoring will stop. Past scans remain in your history.`)) return;
    const r = await fetch(`/api/sites/${site.id}`, { method: 'DELETE' });
    if (r.ok) setSites(old => old.filter(s => s.id !== site.id)); else setError('Could not disconnect. Please try again.');
  }
  return <section id="sites" className="dashboard-section" aria-label="Connected sites"><div className="section-heading"><div><span className="section-eyebrow">CONNECTED</span><h2>Your sites <span>{sites.length}</span></h2></div><Link className="flow-primary" href="/onboarding?step=connect">Connect a site +</Link></div>
    {sites.length === 0 && <div className="card"><p>No sites connected yet. Argon Guard is ready when you are.</p></div>}
    <div className="site-grid">{sites.map(site => <article className="site-card" key={site.id}><div className="site-card-heading"><h3>{site.kind === 'vercel' ? '▲' : '◎'} {site.name}</h3><span className="verified-label">{site.monitoring ? site.kind === 'vercel' ? 'On deployment' : 'Monitoring on' : site.verifiedAt ? 'Monitoring paused' : 'Unverified'}</span></div><a className="site-card-url" href={site.url} target="_blank" rel="noreferrer">{site.url} ↗</a><ScanStatus site={site} /><div className="flow-actions"><button className="flow-primary" disabled={Boolean(busy)} onClick={() => scan(site)}>{busy === site.id ? 'Scanning…' : 'Scan again'}</button><Link className="text-button" href={`/onboarding?site=${site.id}`}>{site.verifiedAt ? 'Manage monitoring' : 'Verify ownership'}</Link><button className="text-button" disabled={Boolean(busy)} onClick={() => disconnect(site)}>Disconnect</button></div></article>)}</div>
    {error && <p className="flow-error" role="alert">{error}</p>}
  </section>;
}
