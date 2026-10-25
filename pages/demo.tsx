import WorkspaceShell from '@/components/WorkspaceShell';
import type { User } from '@/lib/account/auth';
/**
 * Demo mode - manually scan URLs and test with sample phishing pages
 */

import { useState } from 'react';
import Link from 'next/link';
import AgentAvatar from '@/components/AgentAvatar';

// Sample phishing pages for demo
const SAMPLE_PAGES = [
  {
    name: 'Fake PayPal Login',
    html: `<!DOCTYPE html>
<html>
<head><title>PayPal - Log In</title></head>
<body style="font-family: Arial; max-width: 400px; margin: 50px auto; padding: 20px; border: 1px solid #ccc;">
  <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjMwIj48dGV4dCB4PSIwIiB5PSIyMCI+UGF5UGFsPC90ZXh0Pjwvc3ZnPg==" alt="PayPal">
  <h2>Log in to your account</h2>
  <p style="color: red;">Your account has been temporarily suspended. Please verify your identity.</p>
  <form>
    <input type="email" placeholder="Email" style="width: 100%; padding: 10px; margin: 10px 0;">
    <input type="password" placeholder="Password" style="width: 100%; padding: 10px; margin: 10px 0;">
    <button style="width: 100%; padding: 10px; background: #0070ba; color: white; border: none;">Log In</button>
  </form>
  <p style="font-size: 12px; color: #666;">© 1999-2024 PayPal, Inc. All rights reserved.</p>
</body>
</html>`,
    url: 'https://paypa1-secure.example.com'
  },
  {
    name: 'Fake Microsoft Login',
    html: `<!DOCTYPE html>
<html>
<head><title>Sign in to your Microsoft account</title></head>
<body style="font-family: 'Segoe UI'; max-width: 400px; margin: 50px auto; padding: 20px;">
  <h1 style="font-weight: 300;">Microsoft</h1>
  <h2>Sign in</h2>
  <p style="color: #d13438;">Your account requires verification to restore access.</p>
  <form>
    <input type="email" placeholder="Email, phone, or Skype" style="width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #8a8886;">
    <input type="password" placeholder="Password" style="width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #8a8886;">
    <button style="width: 100%; padding: 12px; background: #0078d4; color: white; border: none;">Sign in</button>
  </form>
  <p style="font-size: 12px; color: #666; margin-top: 20px;">Terms of use • Privacy & cookies</p>
</body>
</html>`,
    url: 'https://micr0soft-login.example.com'
  },
  {
    name: 'Legitimate Banking Site (Clean)',
    html: `<!DOCTYPE html>
<html>
<head><title>Example Bank - Home</title></head>
<body style="font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px;">
  <h1>Welcome to Example Bank</h1>
  <p>Your trusted partner in financial services since 1995.</p>
  <div style="margin: 20px 0;">
    <h2>Our Services</h2>
    <ul>
      <li>Personal Banking</li>
      <li>Business Banking</li>
      <li>Investment Services</li>
      <li>Loans and Mortgages</li>
    </ul>
  </div>
  <div style="background: #f5f5f5; padding: 20px; margin: 20px 0;">
    <h3>Open an Account Today</h3>
    <p>Visit one of our branches or call us at 1-800-EXAMPLE</p>
  </div>
  <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; color: #666; font-size: 12px;">
    © 2024 Example Bank. Member FDIC. Equal Housing Lender.
  </footer>
</body>
</html>`,
    url: 'https://examplebank.com'
  }
];

export default function DemoPage({ user }: { user: User }) {
  const [selectedSample, setSelectedSample] = useState(0);
  const [customUrl, setCustomUrl] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [scanError, setScanError] = useState(false);

  const scanSample = async () => {
    setIsScanning(true);
    setResult(null);
    setScanError(false);

    try {
      const sample = SAMPLE_PAGES[selectedSample];
      const response = await fetch('/api/demo/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: sample.html,
          url: sample.url,
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
          <div style={{ marginBottom: '1rem' }}>
            {SAMPLE_PAGES.map((page, i) => (
              <label key={i} style={{ display: 'block', padding: '0.5rem 0' }}>
                <input
                  type="radio"
                  name="sample"
                  checked={selectedSample === i}
                  onChange={() => setSelectedSample(i)}
                  style={{ marginRight: '0.5rem' }}
                />
                {page.name}
              </label>
            ))}
          </div>
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
              border: '1px solid #e5e5e5',
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
          <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
            Note: URL must be publicly accessible
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
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
              <span className={`status-badge status-${result.deployment?.status || 'scanning'}`}>
                {result.deployment?.status || 'scanning'}
              </span>
              <span style={{ fontSize: '0.875rem', color: 'var(--guard-muted)'  }}>
                {result.deployment?.url}
              </span>
            </div>

            {result.rulesResult && (
              <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f9f9f9', borderRadius: '4px' }}>
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
              <div style={{ padding: '1rem', background: '#f0f8ff', borderRadius: '4px' }}>
                <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                  Gemini Score: {(result.geminiAnalysis.score * 100).toFixed(0)}%
                  {result.geminiAnalysis.impersonatedBrand && 
                    ` (Impersonating: ${result.geminiAnalysis.impersonatedBrand})`
                  }
                </div>
                <div style={{ fontSize: '0.8rem', color: '#555', marginBottom: '0.5rem', fontFamily: 'monospace' }}>
                  {result.tiers?.fast && (
                    <>Tier 1: {result.tiers.fast.model} ({result.tiers.fast.thinkingLevel} thinking) {(result.tiers.fast.score * 100).toFixed(0)}% in {result.tiers.fast.latencyMs} ms<br /></>
                  )}
                  {result.tiers?.escalated && result.tiers.deep ? (
                    <>Tier 2: {result.tiers.deep.model} ({result.tiers.deep.thinkingLevel} thinking) {(result.tiers.deep.score * 100).toFixed(0)}% in {result.tiers.deep.latencyMs} ms, escalated because {result.tiers.escalationReason}</>
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
