/**
 * Clusters page - shows grouped phishing campaigns
 */

import { GetServerSideProps } from 'next';
import Link from 'next/link';
import WorkspaceShell from '@/components/WorkspaceShell';
import { getUser, type User } from '@/lib/account/auth';
import { storage, Cluster, Deployment } from '@/lib/storage';

interface ClustersProps {
  user: User;
  clusters: Array<Cluster & { deployments: Deployment[] }>;
}

const formatDate = (timestamp: number) => new Intl.DateTimeFormat('en', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
}).format(timestamp);

export default function ClustersPage({ clusters, user }: ClustersProps) {
  return (
    <WorkspaceShell user={user} title="Content groups">
      <div className="workspace-detail clusters-page">
        <header className="clusters-heading">
          <Link href="/" className="workspace-back" aria-label="Back to dashboard" title="Back to dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m12 5-7 7 7 7M5 12h14" /></svg>
          </Link>
          <div>
            <span className="section-eyebrow">PATTERNS ACROSS YOUR SITES</span>
            <h1>Content groups</h1>
            <p>Scans with similar page content appear together. A match alone does not mean a site is unsafe.</p>
          </div>
          <span className="cluster-total">{clusters.length} {clusters.length === 1 ? 'group' : 'groups'}</span>
        </header>
        {clusters.length === 0 ? (
          <div className="guard-empty">
            <h3>No content groups yet</h3>
            <p>Scan a connected site to start comparing page content.</p>
            <Link href="/onboarding?step=connect" className="flow-primary">Connect a site</Link>
          </div>
        ) : (
          <div className="cluster-list">
            {clusters.map((cluster, index) => (
              <article key={cluster.id} id={cluster.id} className="cluster-card">
                <header className="cluster-card-heading">
                  <span className="cluster-symbol" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" /></svg></span>
                  <div><h2>Content group {index + 1}</h2><p>{cluster.count} {cluster.count === 1 ? 'scan · Waiting for similar content' : 'scans with similar content'}</p></div>
                </header>
                <dl className="cluster-dates">
                  <div><dt>First seen</dt><dd><time dateTime={new Date(cluster.firstSeen).toISOString()}>{formatDate(cluster.firstSeen)}</time></dd></div>
                  <div><dt>Last seen</dt><dd><time dateTime={new Date(cluster.lastSeen).toISOString()}>{formatDate(cluster.lastSeen)}</time></dd></div>
                </dl>
                <ul className="cluster-deployments" aria-label="Scans in this group">
                  {cluster.deployments.map(deployment => (
                    <li key={deployment.id} className="cluster-deployment">
                      <div className="cluster-deployment-info">
                        <a href={deployment.url} target="_blank" rel="noopener noreferrer">{deployment.url}<span aria-hidden="true">↗</span></a>
                        <p>Rules risk score: {(deployment.rulesScore * 100).toFixed(0)}%
                          {deployment.geminiScore !== undefined && ` · Gemini risk score: ${(deployment.geminiScore * 100).toFixed(0)}%`}
                          {deployment.category && ` · ${deployment.category}`}
                        </p>
                      </div>
                      <span className={`status-badge status-${deployment.status}`}>{deployment.status}</span>
                    </li>
                  ))}
                </ul>
                <details className="cluster-details">
                  <summary>Technical details</summary>
                  <dl><div><dt>Group ID</dt><dd><code>{cluster.id}</code></dd></div><div><dt>Content fingerprint</dt><dd><code>{cluster.simHash || 'Unavailable'}</code></dd></div></dl>
                </details>
              </article>
            ))}
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

export const getServerSideProps: GetServerSideProps<ClustersProps> = async ({ req, res }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const user = await getUser(req, res);
  if (!user) return { redirect: { destination: '/onboarding', permanent: false } };
  const records = await storage.getOwnerDeployments(user.id);
  const grouped = new Map<string, Deployment[]>();
  for (const record of records) {
    if (!record.clusterId) continue;
    grouped.set(record.clusterId, [...(grouped.get(record.clusterId) || []), record]);
  }
  const clusters = [...grouped].map(([id, deployments]) => ({
    id, deployments, deploymentIds: deployments.map(d => d.id), count: deployments.length,
    simHash: deployments[0].simHash || '', firstSeen: Math.min(...deployments.map(d => d.createdAt)), lastSeen: Math.max(...deployments.map(d => d.createdAt)),
  }));
  clusters.sort((a, b) => b.lastSeen - a.lastSeen);
  return { props: { user, clusters } };
};
