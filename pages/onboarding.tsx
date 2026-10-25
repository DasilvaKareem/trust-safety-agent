import { useEffect, useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AgentAvatar from '@/components/AgentAvatar';
import ScanStatus from '@/components/ScanStatus';
import SiteSetup, { siteRequest } from '@/components/SiteSetup';
import type { User } from '@/lib/account/auth';
import type { Site } from '@/lib/account/sites';

type Props = { user: User | null; googleReady: boolean; vercelReady: boolean; schedulerReady: boolean; sites: Site[]; connections: { id: string; name: string }[] };
const steps = ['Meet Argon Guard', 'Your account', 'Connect a site', 'First scan', 'Stay protected'];
const errors: Record<string, string> = { auth_setup: 'Sign-in is not available yet. The app owner needs to finish Google sign-in setup.', sign_in: 'Sign-in was cancelled or expired. Please try again.', vercel_setup: 'The Vercel integration is not configured yet. You can add a website URL instead.', vercel_connect: 'Vercel could not be connected. Please try again and check that you selected the correct account.' };
export default function Onboarding({ user, googleReady, vercelReady, schedulerReady, sites, connections }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(user ? 2 : 0);
  const [tour, setTour] = useState(0);
  const [path, setPath] = useState<'website' | 'vercel' | null>(null);
  const [url, setUrl] = useState(''); const [site, setSite] = useState<Site | null>(null);
  const [agentNotice, setAgentNotice] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [installation, setInstallation] = useState('');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState(''); const [nextPage, setNextPage] = useState<number | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); setAgentNotice(''); }, [step]);
  useEffect(() => {
    if (typeof router.query.error === 'string') { setError(errors[router.query.error] || 'Please try again.'); if (!user) setStep(1); }
    if (typeof router.query.installation === 'string' && user) { setPath('vercel'); setInstallation(router.query.installation); }
    if (typeof router.query.site === 'string') { const saved = sites.find(s => s.id === router.query.site); if (saved) { setSite(saved); setStep(saved.lastScan ? 4 : 3); } }
  }, [router.query.error, router.query.installation, router.query.site, user, sites]);
  async function loadProjects(id: string, cursor?: number) {
    setBusy(true); setError('');
    try { const r = await fetch(`/api/integration/projects?installation=${encodeURIComponent(id)}${cursor ? `&until=${cursor}` : ''}`); const data = await r.json(); if (!r.ok) throw new Error(data.error); setProjects(old => cursor ? [...old, ...data.projects] : data.projects); setNextPage(data.next); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load projects.'); } finally { setBusy(false); }
  }
  useEffect(() => { if (installation) { setProjects([]); setSelectedProject(''); void loadProjects(installation); } }, [installation]);
  useEffect(() => {
    if (!site || !['fetching', 'analyzing'].includes(site.scanState)) return;
    let active = true;
    const timer = setInterval(async () => { try { const r = await fetch(`/api/sites/${site.id}`); if (r.ok) { const data = await r.json(); if (active) setSite(data.site); } } catch { /* The scan request supplies the terminal error. */ } }, 1500);
    return () => { active = false; clearInterval(timer); };
  }, [site?.id, site?.scanState]);
  async function connectVercel() {
    setBusy(true); setError('');
    try { const r = await fetch('/api/integration/start', { method: 'POST' }); const data = await r.json(); if (!r.ok) throw new Error(data.error); window.location.assign(data.url); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not connect.'); setBusy(false); }
  }
  async function addSite(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const r = await fetch(path === 'vercel' ? '/api/integration/projects' : '/api/sites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(path === 'vercel' ? { installation, projectId: selectedProject } : { url }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error);
      setSite(data.site); setStep(3);
      await router.replace({ pathname: '/onboarding', query: { site: data.site.id } }, undefined, { shallow: true });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add this site.'); } finally { setBusy(false); }
  }
  async function scan() {
    if (!site) return; setBusy(true); setError(''); setSite({ ...site, scanState: 'fetching', error: null });
    try { setSite(await siteRequest(site.id, 'scan')); }
    catch (e) { const message = e instanceof Error ? e.message : 'Scan failed. Please try again.'; setError(message); setSite(old => old ? { ...old, scanState: 'error', error: message } : null); }
    finally { setBusy(false); }
  }
  const scanning = busy && step === 3;
  function agentMessage(): string {
    if (error) return error;
    if (agentNotice) return agentNotice;
    if (step === 0) return tour === 0
      ? 'Hi, I’m Argon Guard, your site’s new companion. I’ll look for phishing, impersonation, and suspicious content, then explain what I find. Want me to show you how it works?'
      : 'For example, a lookalike domain asking for passwords could be impersonating a brand. I’d show you the suspicious signals and let you decide what to do. I only read your public pages—I never change or take down your site. Ready to connect yours?';
    if (step === 1) return googleReady
      ? 'Let’s save a private space for your sites and scan history. Continue with Google; I only need your name and email, not access to Gmail or Drive. Then we’ll connect your site.'
      : 'Let’s create your private workspace. Google sign-in isn’t ready yet—the app owner needs to finish setting it up before I can continue. You can still go back and explore the introduction.';
    if (step === 2) {
      if (path === 'website') return 'What’s your website address? Paste your homepage or a public page below. I can run a first scan right away; we’ll verify ownership before turning on recurring checks.';
      if (path === 'vercel') {
        if (!vercelReady) return 'Vercel connection isn’t available yet. You can choose “Add any website” and give me your public URL instead.';
        if (installation) return busy ? 'I’m loading your Vercel projects. One moment…' : projects.length ? 'Choose the project you’d like me to watch. I’ll start with its latest production deployment, then check new deployments automatically.' : 'I couldn’t find any accessible projects. Check this integration’s project access in Vercel, or connect another account.';
        return 'Authorize access in Vercel, then I’ll help you choose a project. I’ll check its current production deployment and keep watching new ones.';
      }
      return `Nice to meet you${user ? `, ${user.name}` : ''}. Where does your site live? Connect Vercel for deployment checks, or add a website from any host.`;
    }
    if (step === 3) {
      if (site?.scanState === 'error') return site.error || 'I couldn’t finish that scan. Let’s try again.';
      if (scanning) return site?.scanState === 'analyzing' ? 'I’ve reached your page. I’m checking for phishing and abuse now. This can take about a minute.' : 'I’m connecting to your site and reading its public page. I won’t modify anything.';
      if (site?.lastScan) return `${site.lastScan.modelUsed ? 'Your scan is complete.' : 'I finished the rules-based check, but Gemini analysis was unavailable, so this is a limited result.'} ${site.lastScan.status === 'clean' ? 'I didn’t detect threats in this page.' : 'I found signals that need your attention; the details are below.'} This is a point-in-time check, not a guarantee for the whole site. Next, let’s set up monitoring.`;
      return `I’m ready to take a first look at ${site?.name || 'your site'}. Start the scan when you’re ready; I’ll explain the results here.`;
    }
    if (site?.kind === 'vercel' && !site.verifiedAt) return 'I need you to reconnect Vercel before I can monitor this project again.';
    if (!site?.verifiedAt) return `Before I check ${site?.name || 'your site'} regularly, I need to confirm it’s yours. Download the file below and publish it at the shown URL, then ask me to check it. Keep the file there while monitoring is enabled.`;
    if (site.kind === 'website' && !schedulerReady) return 'Ownership confirmed! Scheduled checks aren’t available yet, but you can run manual scans from your dashboard.';
    if (site.monitoring) return `You’re all set. I’ll check ${site.name} ${site.kind === 'vercel' ? 'on new production deployments' : 'approximately once a day'}. Your findings will be in your dashboard. You can pause me anytime.`;
    return `Ownership confirmed. Enable monitoring and I’ll check ${site.name} ${site.kind === 'vercel' ? 'on new production deployments' : 'approximately once a day'}.`;
  }
  const guide = agentMessage();
  return <><Head><title>Meet Argon Guard</title><meta name="description" content="Connect your site and meet your personal Argon Guard scanning agent." /></Head>
    <main className="onboarding-shell welcome-shell">
      <header className="flow-header"><Link className="flow-brand" href="/onboarding"><span className="brand-mark">✦</span> Argon Guard</Link><div>{user ? <><Link href="/">My dashboard ↗</Link><form action="/api/auth/logout" method="post"><button className="text-button">Sign out</button></form></> : <button className="text-button" onClick={() => { setStep(1); setError(''); }}>Sign in</button>}</div></header>
      <div className="welcome-layout">
        <nav className="welcome-progress" aria-label="Onboarding progress"><ol>{steps.map((label, i) => <li key={label} className={i === step ? 'current' : i < step ? 'done' : ''} aria-label={`${label}${i < step ? ', complete' : ''}`} aria-current={i === step ? 'step' : undefined}><span /></li>)}</ol><span>{step + 1} / 5 · {steps[step]}</span></nav>
        <aside className="welcome-guide">
          <AgentAvatar variant="conversation" state={scanning ? 'thinking' : site?.scanState === 'error' ? 'confused' : step === 4 || site?.lastScan?.status === 'clean' ? 'happy' : 'idle'} message={guide} />
        </aside>
        <section className="welcome-content" aria-label="Setup">

          <div className="flow-content"><h1 className="sr-only" tabIndex={-1} ref={heading}>{steps[step]}</h1>
          {step === 0 && <>
            <div className="flow-actions"><button className="flow-primary" onClick={() => tour === 0 ? setTour(1) : setStep(1)}>{tour === 0 ? 'Show me how it works' : 'Let’s get started'} <span>→</span></button>{tour === 0 ? <button className="text-button" onClick={() => setStep(1)}>Skip introduction</button> : <button className="back-icon-button" aria-label="Back" title="Back" onClick={() => setTour(0)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7" /></svg></button>}</div>
          </>}
          {step === 1 && <div className="agent-account-actions">{googleReady ? <a className="google-button" href="/api/auth/google"><span>G</span> Continue with Google</a> : <button className="google-button" disabled>Google sign-in unavailable</button>}<button className="back-icon-button" aria-label="Back to introduction" title="Back to introduction" onClick={() => { setStep(0); setError(''); }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7" /></svg></button></div>}
          {step === 2 && <><div className="connection-options"><button className={`connection-option ${path === 'vercel' ? 'selected' : ''}`} aria-pressed={path === 'vercel'} onClick={() => { setPath('vercel'); setError(''); }}><span className="connection-icon">▲</span><strong>Connect Vercel</strong></button><button className={`connection-option ${path === 'website' ? 'selected' : ''}`} aria-pressed={path === 'website'} onClick={() => { setPath('website'); setError(''); }}><span className="connection-icon globe-icon">◎</span><strong>Add any website</strong></button></div>
            {path === 'website' && <form className="connect-form" onSubmit={addSite}><label htmlFor="site-url">Your website URL</label><input id="site-url" name="url" autoComplete="url" inputMode="url" placeholder="https://your-site.com" value={url} onChange={e => setUrl(e.target.value)} required maxLength={2048} /><button className="flow-primary" disabled={busy || !url.trim()}>{busy ? 'Connecting…' : 'Connect website →'}</button></form>}
            {path === 'vercel' && <div className="connect-form">{connections.length > 0 && <><label htmlFor="connection">Existing Vercel connection</label><select id="connection" value={installation} onChange={e => setInstallation(e.target.value)}><option value="">Choose a connection</option>{connections.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></>}{installation ? <form onSubmit={addSite}><label htmlFor="project">Select a project</label><select id="project" value={selectedProject} onChange={e => setSelectedProject(e.target.value)} required><option value="">{busy ? 'Loading…' : 'Choose a project'}</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{nextPage && <button type="button" className="text-button" disabled={busy} onClick={() => loadProjects(installation, nextPage)}>Load more projects</button>}<button className="flow-primary" disabled={busy || !selectedProject}>{busy ? 'Connecting…' : 'Connect project →'}</button></form> : null}<button className={installation ? 'text-button' : 'flow-primary'} disabled={busy || !vercelReady} onClick={connectVercel}>{busy && !installation ? 'Opening Vercel…' : installation ? 'Connect another Vercel account' : 'Authorize with Vercel ↗'}</button></div>}
            {sites.length > 0 && <div className="resume-setup"><h3>Pick up where you left off</h3>{sites.map(saved => <button key={saved.id} className="resume-site" onClick={() => { setSite(saved); setStep(saved.lastScan ? 4 : 3); }}>{saved.name}<span>{saved.lastScan ? 'Manage monitoring' : 'Run first scan'} →</span></button>)}</div>}
          </>}
          {step === 3 && site && <><div className="connected-site"><span>{site.kind === 'vercel' ? '▲' : '◎'}</span><div><strong>{site.name}</strong><p>{site.url}</p></div><small>CONNECTED</small></div><ScanStatus site={site} compact /><div className="flow-actions">{!site.lastScan || site.scanState === 'error' ? <button className="flow-primary" disabled={busy} onClick={scan}>{scanning ? 'Scan in progress…' : site.scanState === 'error' ? 'Try scan again →' : 'Run my first scan →'}</button> : <button className="flow-primary" disabled={busy} onClick={() => setStep(4)}>Set up monitoring →</button>}<Link className="text-button" href="/">Finish later</Link></div></>}
          {step === 4 && site && <><SiteSetup site={site} onChange={setSite} schedulerReady={schedulerReady} onMessage={setAgentNotice} /><div className="flow-actions"><Link className="flow-primary" href="/">Go to my dashboard →</Link><button className="text-button" onClick={() => { setStep(2); setSite(null); setPath(null); void router.replace('/onboarding', undefined, { shallow: true }); }}>Add another site</button></div></>}
          </div>
        </section>
      </div>
    </main></>;
}
export const getServerSideProps: GetServerSideProps<Props> = async ({ req, res }) => {
  const { getUser, authReady } = await import('@/lib/account/auth');
  const { listSites } = await import('@/lib/account/sites');
  const { vercelReady } = await import('@/lib/account/vercel');
  const { storage } = await import('@/lib/storage');
  res.setHeader('Cache-Control', 'private, no-store');
  const user = await getUser(req);
  const connections = user ? (await storage.getAllInstallations()).filter(i => i.ownerId === user.id && !i.revokedAt).map(i => ({ id: i.id, name: i.teamId || 'Personal Vercel account' })) : [];
  return { props: { user, googleReady: authReady(), vercelReady: vercelReady(), schedulerReady: Boolean(process.env.CRON_SECRET), sites: user ? await listSites(user.id) : [], connections } };
};
