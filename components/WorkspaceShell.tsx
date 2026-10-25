import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { User } from '@/lib/account/auth';

type IconName = 'panel' | 'home' | 'globe' | 'activity' | 'layers' | 'scan' | 'plus' | 'logout';
export function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    panel: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M9 4v16" /></>,
    home: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    activity: <><path d="M3 12h4l3-7 4 14 3-7h4" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" /></>,
    scan: <><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3M7 12h10" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    logout: <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m6-12 4 4-4 4m-6-4h10" /></>,
  };
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
const links: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Overview', icon: 'home' },
  { href: '/#sites', label: 'Your sites', icon: 'globe' },
  { href: '/#activity', label: 'Scan history', icon: 'activity' },
  { href: '/clusters', label: 'Clusters', icon: 'layers' },
  { href: '/demo', label: 'Try a scan', icon: 'scan' },
];
export default function WorkspaceShell({ user, title = 'Overview', children }: { user: User; title?: string; children: ReactNode }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const sync = () => { setMobile(media.matches); try { setCollapsed(media.matches || localStorage.getItem('argon-sidebar') === 'collapsed'); } catch { setCollapsed(media.matches); } };
    sync(); media.addEventListener('change', sync); return () => media.removeEventListener('change', sync);
  }, []);
  function setOpen(open: boolean) {
    setCollapsed(!open);
    if (!mobile) { try { localStorage.setItem('argon-sidebar', open ? 'expanded' : 'collapsed'); } catch {} }
    if (!open) toggle.current?.focus();
  }
  useEffect(() => {
    if (!mobile || collapsed) return;
    const previous = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setCollapsed(true); toggle.current?.focus(); }
      if (event.key === 'Tab') {
        const items = sidebar.current?.querySelectorAll<HTMLElement>('a, button');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', keydown); };
  }, [mobile, collapsed]);
  return <div className={`guard-workspace ${collapsed ? 'nav-collapsed' : 'nav-expanded'}`}>
    <a className="guard-skip" href="#workspace-content">Skip to content</a>
    {mobile && !collapsed && <button className="nav-backdrop" aria-label="Close navigation" tabIndex={-1} onClick={() => setOpen(false)} />}
    <aside className="guard-sidebar" ref={sidebar} aria-label="Workspace navigation">
      <div className="sidebar-brand"><Link href="/" aria-label="Argon Guard home"><span className="brand-mark">✦</span><span className="nav-label">Argon Guard</span></Link></div>
      <button ref={toggle} className="sidebar-toggle" onClick={() => setOpen(collapsed)} aria-expanded={!collapsed} aria-controls="workspace-navigation" aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'}><NavIcon name="panel" /><span className="nav-label">Collapse sidebar</span></button>
      <Link href="/onboarding?step=connect" className="sidebar-connect" aria-label="Connect a site" title="Connect a site"><NavIcon name="plus" /><span className="nav-label">Connect a site</span></Link>
      <nav id="workspace-navigation" className="sidebar-links">
        <span className="sidebar-caption nav-label">WORKSPACE</span>
        {links.map(link => <Link key={link.href} href={link.href} className={`sidebar-link ${router.asPath === link.href ? 'active' : ''}`} aria-label={link.label} title={collapsed ? link.label : undefined} aria-current={router.asPath === link.href ? 'page' : undefined} onClick={() => { if (mobile) setOpen(false); }}><NavIcon name={link.icon} /><span className="nav-label">{link.label}</span></Link>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-profile" title={user.name}><span className="profile-initial">{user.name.slice(0, 1).toUpperCase()}</span><div className="nav-label"><strong>{user.name}</strong><small>Personal workspace</small></div></div><form method="post" action="/api/auth/logout"><button className="sidebar-link" aria-label="Sign out" title={collapsed ? 'Sign out' : undefined}><NavIcon name="logout" /><span className="nav-label">Sign out</span></button></form></div>
    </aside>
    <div className="guard-body" inert={mobile && !collapsed}>
      <header className="guard-topbar"><span>Workspace <span className="breadcrumb-slash">/</span> <strong>{title}</strong></span><span className="workspace-private"><span />Private workspace</span></header>
      <main className="guard-main" id="workspace-content" tabIndex={-1}>{children}</main>
      <footer className="guard-footer">Read-only checks. Clear findings. You’re in control.</footer>
    </div>
  </div>;
}
