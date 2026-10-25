/**
 * Dashboard home page - shows recent deployments, review queue, and metrics
 */

import { GetServerSideProps } from 'next';
import Link from 'next/link';
import AgentAvatar from '@/components/AgentAvatar';
import ConnectedSites from '@/components/ConnectedSites';
import { getUser, type User } from '@/lib/account/auth';
import { listSites, type Site } from '@/lib/account/sites';
import { storage, Deployment } from '@/lib/storage';

interface DashboardProps {
  user: User;
  sites: Site[];
  recentDeployments: Deployment[];
  reviewQueue: Deployment[];
  stats: {
    total: number;
    clean: number;
    review: number;
    flagged: number;
    clusters: number;
  };
}

export default function Dashboard({ recentDeployments, reviewQueue, stats, user, sites }: DashboardProps) {
  return (
    <div className="container">
      <nav className="workspace-nav"><Link className="flow-brand" href="/"><span className="brand-mark">✦</span> Trust & Safety</Link><div><span>{user.name}’s workspace</span><form method="post" action="/api/auth/logout"><button className="text-button">Sign out</button></form></div></nav>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
          Trust & Safety Dashboard
        </h1>
        <p style={{ color: '#666' }}>
          Vercel deployment phishing and abuse detection
        </p>
      </header>

      {/* Stats Overview */}
      <AgentAvatar message={reviewQueue.length > 0 ? `${reviewQueue.length} deployment${reviewQueue.length === 1 ? '' : 's'} waiting for your review.` : 'Ready to inspect your next deployment.'} state={reviewQueue.length > 0 ? 'suspicious' : 'idle'} />
      <div className="grid grid-2" style={{ marginBottom: '2rem' }}>
        <div className="card metric">
          <div className="metric-value">{stats.total}</div>
          <div className="metric-label">Recent Scans</div>
        </div>
        <div className="card metric">
          <div className="metric-value">{stats.clean}</div>
          <div className="metric-label">Clean</div>
        </div>
        <div className="card metric">
          <div className="metric-value">{stats.review}</div>
          <div className="metric-label">Pending Review</div>
        </div>
        <div className="card metric">
          <div className="metric-value">{stats.flagged}</div>
          <div className="metric-label">Flagged</div>
        </div>
      </div>

      <ConnectedSites initialSites={sites} />

      {/* Review Queue */}
      {reviewQueue.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
            Review Queue ({reviewQueue.length})
          </h2>
          {reviewQueue.map(deployment => (
            <DeploymentCard key={deployment.id} deployment={deployment} showReviewButtons />
          ))}
        </section>
      )}

      {/* Recent Deployments */}
      <section>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
          Recent Deployments
        </h2>
        {recentDeployments.length === 0 ? (
          <div className="card">
            <p style={{ color: '#666', textAlign: 'center' }}>
              No deployments yet. Try the <Link href="/demo" style={{ color: '#0070f3' }}>demo mode</Link>.
            </p>
          </div>
        ) : (
          recentDeployments.map(deployment => (
            <DeploymentCard key={deployment.id} deployment={deployment} />
          ))
        )}
      </section>

      {/* Navigation */}
      <nav style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/demo" className="btn btn-primary">
          Demo Mode
        </Link>
        <Link href="/clusters" className="btn btn-secondary">
          View Clusters ({stats.clusters})
        </Link>
      </nav>
    </div>
  );
}

function DeploymentCard({ deployment, showReviewButtons }: { deployment: Deployment; showReviewButtons?: boolean }) {
  const statusClass = `status-${deployment.status}`;
  
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className={`status-badge ${statusClass}`}>
              {deployment.status}
            </span>
            <code style={{ fontSize: '0.875rem', color: '#666' }}>
              {deployment.id.substring(0, 12)}...
            </code>
          </div>
          <a 
            href={deployment.url} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#0070f3', wordBreak: 'break-all' }}
          >
            {deployment.url}
          </a>
        </div>
        <div style={{ fontSize: '0.875rem', color: '#999', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
          {new Date(deployment.createdAt).toLocaleString()}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
          Rules Score: {(deployment.rulesScore * 100).toFixed(0)}%
        </div>
        {deployment.rulesReasons.length > 0 && (
          <ul style={{ fontSize: '0.875rem', paddingLeft: '1.5rem', color: '#666' }}>
            {deployment.rulesReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        )}
      </div>

      {deployment.geminiScore !== undefined && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
            Gemini Score: {(deployment.geminiScore * 100).toFixed(0)}%
            {deployment.geminiImpersonatedBrand && ` (${deployment.geminiImpersonatedBrand})`}
          </div>
          {deployment.geminiReasons && deployment.geminiReasons.length > 0 && (
            <ul style={{ fontSize: '0.875rem', paddingLeft: '1.5rem', color: '#666' }}>
              {deployment.geminiReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {deployment.clusterId && (
        <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
          Cluster: <Link href={`/clusters#${deployment.clusterId}`} style={{ color: '#0070f3' }}>
            {deployment.clusterId}
          </Link>
        </div>
      )}

      {showReviewButtons && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn btn-success"
            onClick={() => handleReview(deployment.id, 'approved')}
          >
            Approve
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => handleReview(deployment.id, 'dismissed')}
          >
            Dismiss
          </button>
          <button 
            className="btn btn-danger"
            onClick={() => handleReview(deployment.id, 'blocked')}
          >
            Block
          </button>
        </div>
      )}

      {deployment.reviewDecision && (
        <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '1rem' }}>
          Reviewed: {deployment.reviewDecision} by {deployment.reviewedBy} 
          {deployment.reviewedAt && ` on ${new Date(deployment.reviewedAt).toLocaleString()}`}
        </div>
      )}
    </div>
  );
}

async function handleReview(deploymentId: string, decision: 'approved' | 'dismissed' | 'blocked') {
  const response = await fetch('/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deploymentId, decision }),
  });

  if (response.ok) {
    (globalThis as any).location?.reload();
  } else {
    (globalThis as any).alert?.('Review failed');
  }
}

export const getServerSideProps: GetServerSideProps<DashboardProps> = async ({ req, res }) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const user = await getUser(req);
  if (!user) return { redirect: { destination: '/onboarding', permanent: false } };
  const recentDeployments = await storage.getOwnerDeployments(user.id);
  const reviewQueue = recentDeployments.filter(d => d.status === 'review' && !d.reviewDecision);
  const allClusters = new Set(recentDeployments.map(d => d.clusterId).filter(Boolean));
  const sites = await listSites(user.id);

  const stats = {
    total: recentDeployments.length,
    clean: recentDeployments.filter(d => d.status === 'clean').length,
    review: reviewQueue.length,
    flagged: recentDeployments.filter(d => d.status === 'flagged').length,
    clusters: allClusters.size,
  };

  return {
    props: {
      user,
      sites,
      recentDeployments,
      reviewQueue,
      stats,
    },
  };
};
