import type { Site } from '@/lib/account/sites';
export default function ScanStatus({ site, compact = false }: { site: Site; compact?: boolean }) {
  const running = site.scanState === 'fetching' || site.scanState === 'analyzing';
  if (compact && (running || site.scanState === 'error')) return null;
  if (running) return <div className="scan-progress" role="status"><span className="scan-spinner" /><div><strong>{site.scanState === 'fetching' ? 'Reading your public page' : 'Checking for phishing and abuse'}</strong><p>{site.scanState === 'fetching' ? 'Connecting securely and collecting the page content.' : 'Running detection rules and available Gemini analysis. This can take about a minute.'}</p></div></div>;
  if (site.scanState === 'error') return <p className="flow-error" role="alert">{site.error}</p>;
  if (!site.lastScan) return null;
  const scan = site.lastScan;
  return <div className={`scan-result result-${scan.status}`}>
    <div className="result-title"><span className={`status-badge status-${scan.status}`}>{scan.status === 'clean' ? 'No threats detected' : scan.status === 'flagged' ? 'Potential threat found' : 'Needs review'}</span><span>{Math.round(scan.score * 100)}% risk score</span></div>
    {!compact && <p>{scan.modelUsed ? 'Rules and Gemini analysis completed.' : 'Rules-only result. Gemini analysis was unavailable; this is not a complete AI assessment.'}</p>}
    {scan.reasons.length > 0 && <ul>{scan.reasons.slice(0, 5).map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
    {!compact && <small>A scan is a point-in-time check of this page, not a guarantee that the entire site is safe.</small>}
  </div>;
}
