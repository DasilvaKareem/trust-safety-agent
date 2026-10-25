import WorkspaceShell from '@/components/WorkspaceShell';
import type { User } from '@/lib/account/auth';
/**
 * Demo mode - manually scan URLs and test with sample phishing and hate/extremism pages
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AgentAvatar from '@/components/AgentAvatar';
import { useRouter } from 'next/router';
import { DEMO_FIXTURES, type DemoFixture } from '@/lib/demo/fixtures';
import type { ContentCategory } from '@/lib/gemini';
import type { ImpersonationReport } from '@/lib/impersonation';

const CATEGORY_LABELS: Record<ContentCategory, string> = {
  phishing: 'Phishing',
  scam: 'Scam',
  hate_harassment: 'Hate & harassment',
  violent_extremism: 'Violent extremism',
  benign: 'Benign',
};

const DECIDED_BY_LABELS: Record<'rules' | 'flash' | 'argon' | 'heuristic', string> = {
  rules: 'Rules',
  heuristic: 'Heuristic',
  flash: 'Gemini 3.8 Flash',
  argon: 'Gemini 4 Argon',
};

const PHISHING_FIXTURES = DEMO_FIXTURES.filter(
  f => f.kind === 'phishing' || f.slug === 'legit-bank'
);
const HATE_FIXTURES = DEMO_FIXTURES.filter(
  f => f.kind === 'hate' || f.slug === 'anti-hate-education'
);

export default function DemoPage({ user }: { user: User }) {
  const router = useRouter();
  const [selectedSlug, setSelectedSlug] = useState<string>(DEMO_FIXTURES[0].slug);
  const [customUrl, setCustomUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [scanError, setScanError] = useState(false);

  const [impersonationUrl, setImpersonationUrl] = useState(
    process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost')
      ? process.env.NEXT_PUBLIC_APP_URL
      : 'https://trust-safety-agent.vercel.app'
  );
  const [impersonationBrand, setImpersonationBrand] = useState('');
  const [isFindingImpersonators, setIsFindingImpersonators] = useState(false);
  const [impersonationReport, setImpersonationReport] = useState<ImpersonationReport | null>(null);
  const [impersonationError, setImpersonationError] = useState<string | null>(null);

  useEffect(() => {
    const q = router.query.sample;
    if (typeof q === 'string' && DEMO_FIXTURES.some(f => f.slug === q)) {
      setSelectedSlug(q);
    }
  }, [router.query.sample]);

  const findImpersonatorsForSite = async () => {
    if (!impersonationUrl.trim()) return;

    setIsFindingImpersonators(true);
    setImpersonationReport(null);
    setImpersonationError(null);

    try {
      const response = await fetch('/api/impersonation/find', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: impersonationUrl.trim(),
          brand: impersonationBrand.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Impersonation check failed');
      }
      setImpersonationReport(data);
    } catch (error) {
      setImpersonationError(error instanceof Error ? error.message : 'Impersonation check failed');
    } finally {
      setIsFindingImpersonators(false);
    }
  };

  const scanSample = async () => {
    setIsScanning(true);
    setResult(null);
    setScanError(false);

    try {
      const response = await fetch('/api/demo/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sample: selectedSlug,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Scan failed');
      setResult(data);
    } catch (error) {
      setScanError(true);
      console.error('Scan failed:', error);
      (globalThis as any).alert?.('Scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  const scanCustomUrl = async () => {
    if (!customUrl) return;

    setIsScanning(true);
    setResult(null);
    setScanError(false);

    try {
      const response = await fetch('/api/demo/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: customUrl,
          fetchHtml: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Scan failed');
      setResult(data);
    } catch (error) {
      setScanError(true);
      console.error('Scan failed:', error);
      (globalThis as any).alert?.('Scan failed');
    } finally {
      setIsScanning(false);
    }
  };

  const renderFixtureGroup = (title: string, fixtures: DemoFixture[]) => (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ fontSize: '0.8rem', fontWeight: '600', textTransform: 'uppercase', color: '#A1A1A1', marginBottom: '0.25rem' }}>
        {title}
      </div>
      {fixtures.map(page => (
        <div
          key={page.slug}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.4rem 0',
          }}
        >
          <label style={{ cursor: 'pointer' }}>
            <input
              type="radio"
              name="sample"
              checked={selectedSlug === page.slug}
              onChange={() => setSelectedSlug(page.slug)}
              style={{ marginRight: '0.5rem' }}
            />
            {page.name}
          </label>
          <a
            href={`/fixtures/${page.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '0.8rem', color: '#0090FF', marginLeft: '0.5rem', whiteSpace: 'nowrap' }}
          >
            view page
          </a>
        </div>
      ))}
    </div>
  );

  const resolvedCategory: ContentCategory | undefined =
    result?.category ?? result?.deployment?.category ?? result?.geminiAnalysis?.category;
  const resolvedDecidedBy: 'rules' | 'flash' | 'argon' | undefined = result?.decidedBy;
  const resolvedLatencyMs: number | undefined =
    result?.totalLatencyMs ?? result?.tiers?.totalLatencyMs;

  return (
    <WorkspaceShell user={user} title="Try a scan"><div className="workspace-detail">
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
          Demo Mode
        </h1>
        <p style={{ color: 'var(--guard-muted)'  }}>
          Test the Argon Guard scanner with sample pages or custom URLs
        </p>
      </header>

      <AgentAvatar
        state={isScanning ? 'thinking' : scanError ? 'confused' : result?.deployment?.status === 'clean' ? 'happy' : result?.deployment ? 'suspicious' : 'idle'}
        message={isScanning ? 'Inspecting this page for phishing and abuse…' : scanError ? 'The scan could not finish. Please try again.' : result?.deployment?.status === 'clean' ? 'Scan complete. No threats detected by this scan.' : result?.deployment ? 'Scan complete. This page needs your attention.' : 'Choose a sample or enter a URL. I’m ready.'}
      />
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* Sample Pages */}
        <section className="card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
            Sample Pages
          </h2>
          {renderFixtureGroup('Phishing', PHISHING_FIXTURES)}
          {renderFixtureGroup('Hate & extremism', HATE_FIXTURES)}
          <button
            className="btn btn-primary"
            onClick={scanSample}
            disabled={isScanning}
            style={{ width: '100%' }}
          >
            {isScanning ? 'Scanning...' : 'Scan Sample Page'}
          </button>
        </section>

        {/* Custom URL */}
        <section className="card">
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
            Scan Custom URL
          </h2>
          <input
            type="url"
            placeholder="https://example.com"
            value={customUrl}
            onChange={(e) => setCustomUrl((e.target as HTMLInputElement).value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '1rem',
              border: '1px solid #2E2E2E',
              borderRadius: '4px',
            }}
          />
          <button
            className="btn btn-primary"
            onClick={scanCustomUrl}
            disabled={isScanning || !customUrl}
            style={{ width: '100%' }}
          >
            {isScanning ? 'Scanning...' : 'Scan URL'}
          </button>
          <p style={{ fontSize: '0.75rem', color: '#A1A1A1', marginTop: '0.5rem' }}>
            Note: URL must be publicly accessible (e.g. a live /fixtures/&lt;slug&gt; URL)
          </p>
        </section>
      </div>

      {/* Results */}
      {result && (
        <section className="card" style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
            Scan Results
          </h2>

          <div style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <span className={`status-badge status-${result.deployment?.status || 'scanning'}`}>
                {result.deployment?.status || 'scanning'}
              </span>
              {resolvedCategory && (
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    background: resolvedCategory === 'benign' ? '#15332b' : '#3b202b',
                    color: resolvedCategory === 'benign' ? '#98d9bc' : '#f2a6bc',
                  }}
                >
                  {CATEGORY_LABELS[resolvedCategory] ?? resolvedCategory}
                </span>
              )}
              {resolvedDecidedBy && (
                <span style={{ fontSize: '0.85rem', color: 'var(--guard-muted)' }}>
                  Decided by: <strong>{DECIDED_BY_LABELS[resolvedDecidedBy] ?? resolvedDecidedBy}</strong>
                </span>
              )}
              {resolvedLatencyMs !== undefined && (
                <span style={{ fontSize: '0.85rem', color: 'var(--guard-muted)' }}>
                  Total latency: <strong>{resolvedLatencyMs} ms</strong>
                </span>
              )}
              <span style={{ fontSize: '0.875rem', color: 'var(--guard-muted)' }}>
                {result.deployment?.url}
              </span>
            </div>

            {result.rulesResult && (
              <div style={{ marginBottom: '1rem', padding: '1rem', background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: '8px', color: '#EDEDED' }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                  Rules Score: {(result.rulesResult.score * 100).toFixed(0)}%
                </div>
                {result.rulesResult.reasons.length > 0 && (
                  <ul style={{ fontSize: '0.875rem', paddingLeft: '1.5rem' }}>
                    {result.rulesResult.reasons.map((reason: string, i: number) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {result.geminiAnalysis && (
              <div style={{ padding: '1rem', background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: '8px', color: '#EDEDED' }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                  Gemini Score: {(result.geminiAnalysis.score * 100).toFixed(0)}%
                  {result.geminiAnalysis.category &&
                    ` • Category: ${CATEGORY_LABELS[result.geminiAnalysis.category as ContentCategory] ?? result.geminiAnalysis.category}`
                  }
                  {result.geminiAnalysis.impersonatedBrand && 
                    ` (Impersonating: ${result.geminiAnalysis.impersonatedBrand})`
                  }
                </div>
                <div style={{ fontSize: '0.8rem', color: '#A1A1A1', marginBottom: '0.5rem', fontFamily: 'monospace' }}>
                  {result.tiers?.fast && (
                    <>Tier 1: {result.tiers.fast.model} ({result.tiers.fast.thinkingLevel} thinking) {(result.tiers.fast.score * 100).toFixed(0)}% ({result.tiers.fast.category}) in {result.tiers.fast.latencyMs} ms<br /></>
                  )}
                  {result.tiers?.escalated && result.tiers.deep ? (
                    <>Tier 2: {result.tiers.deep.model} ({result.tiers.deep.thinkingLevel} thinking) {(result.tiers.deep.score * 100).toFixed(0)}% ({result.tiers.deep.category}) in {result.tiers.deep.latencyMs} ms, escalated because {result.tiers.escalationReason}</>
                  ) : result.tiers ? (
                    <>Tier 2: not needed</>
                  ) : null}
                  {result.geminiAnalysis.fallback && <><br />Fallback result (no model verdict)</>}
                </div>
                {result.geminiAnalysis.reasons.length > 0 && (
                  <ul style={{ fontSize: '0.875rem', paddingLeft: '1.5rem' }}>
                    {result.geminiAnalysis.reasons.map((reason: string, i: number) => (
                      <li key={i}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {result.deployment?.id && (
            <p style={{ fontSize: '0.875rem', color: 'var(--guard-muted)'  }}>
              Deployment ID: <code>{result.deployment.id}</code>
            </p>
          )}
        </section>
      )}

      {/* Outward-facing Impersonation Finder */}
      <section className="card" style={{ marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
          Find impersonators of this site
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#A1A1A1', marginBottom: '1rem' }}>
          Generate typosquat / lookalike candidates, probe Certificate Transparency logs, resolve live public IPv4 hosts, and judge potential brand impersonators with Gemini Flash &rarr; Argon.
        </p>

        <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
          <div>
            <label
              htmlFor="impersonation-url"
              style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.35rem', color: '#A1A1A1' }}
            >
              Protected Site URL
            </label>
            <input
              id="impersonation-url"
              type="url"
              placeholder="https://trust-safety-agent.vercel.app"
              value={impersonationUrl}
              onChange={e => setImpersonationUrl((e.target as HTMLInputElement).value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #2E2E2E',
                borderRadius: '4px',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="impersonation-brand"
              style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.35rem', color: '#A1A1A1' }}
            >
              Brand Override (optional)
            </label>
            <input
              id="impersonation-brand"
              type="text"
              placeholder="Derived from title or domain if blank"
              value={impersonationBrand}
              onChange={e => setImpersonationBrand((e.target as HTMLInputElement).value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #2E2E2E',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={findImpersonatorsForSite}
          disabled={isFindingImpersonators || !impersonationUrl.trim()}
        >
          {isFindingImpersonators ? 'Searching… (up to ~30s)' : 'Find impersonators'}
        </button>

        {impersonationError && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1rem',
              background: '#3b202b',
              color: '#f2a6bc',
              border: '1px solid #663c50',
              borderRadius: '4px',
              fontSize: '0.875rem',
            }}
          >
            {impersonationError}
          </div>
        )}

        {impersonationReport && (
          <div style={{ marginTop: '1.5rem' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '0.75rem 1rem',
                background: '#1A1A1A',
                border: '1px solid #2E2E2E',
                borderRadius: '8px',
                color: '#EDEDED',
                fontSize: '0.85rem',
                marginBottom: '1rem',
              }}
            >
              <span>
                Brand: <strong>{impersonationReport.protected.brand}</strong> ({impersonationReport.protected.domain})
              </span>
              <span>
                Generated: <strong>{impersonationReport.candidatesGenerated}</strong>
              </span>
              <span>
                Resolved: <strong>{impersonationReport.candidatesResolved}</strong>
              </span>
              <span>
                Live: <strong>{impersonationReport.liveHosts}</strong>
              </span>
              <span>
                Compared: <strong>{impersonationReport.compared}</strong>
              </span>
              <span>
                Hits: <strong>{impersonationReport.hits.length}</strong>
              </span>
              <span>
                Elapsed: <strong>{impersonationReport.elapsedMs} ms</strong>
              </span>
              {impersonationReport.truncated && (
                <span style={{ color: '#e9cb8b', fontWeight: '600' }}>
                  Truncated by 30s budget
                </span>
              )}
              {impersonationReport.ctError && (
                <span style={{ color: '#A1A1A1' }}>
                  CT note: {impersonationReport.ctError}
                </span>
              )}
            </div>

            {impersonationReport.hits.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: '#A1A1A1', padding: '0.75rem 0' }}>
                No impersonators found in this pass (real scan; absence of hits is a valid result).
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #2E2E2E', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem' }}>Host</th>
                      <th style={{ padding: '0.5rem' }}>Confidence</th>
                      <th style={{ padding: '0.5rem' }}>Decided By</th>
                      <th style={{ padding: '0.5rem' }}>Heuristic</th>
                      <th style={{ padding: '0.5rem' }}>SimHash Dist</th>
                      <th style={{ padding: '0.5rem' }}>Reasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impersonationReport.hits.map(hit => (
                      <tr key={hit.host} style={{ borderBottom: '1px solid #2E2E2E' }}>
                        <td style={{ padding: '0.5rem', fontWeight: '500' }}>
                          <a
                            href={hit.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#0090FF', textDecoration: 'underline' }}
                          >
                            {hit.host}
                          </a>
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {(hit.confidence * 100).toFixed(0)}%
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {DECIDED_BY_LABELS[hit.decidedBy] ?? hit.decidedBy}
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {(hit.heuristicScore * 100).toFixed(0)}%
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {hit.simHashDistance !== undefined ? hit.simHashDistance : 'N/A'}
                        </td>
                        <td style={{ padding: '0.5rem' }}>
                          {hit.reasons.join('; ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <nav style={{ marginTop: '2rem' }}>
        <Link href="/" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </nav>
    </div></WorkspaceShell>
  );
}

export const getServerSideProps: import('next').GetServerSideProps = async ({ req, res }) => {
  const { getUser } = await import('@/lib/account/auth');
  res.setHeader('Cache-Control', 'private, no-store');
  const user = await getUser(req, res);
  if (!user) return { redirect: { destination: '/onboarding', permanent: false } };
  return { props: { user } };
};
