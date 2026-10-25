/**
 * Dashboard home page - shows recent deployments, review queue, and metrics
 */

import { GetServerSideProps } from 'next';
import Link from 'next/link';
import WorkspaceShell from '@/components/WorkspaceShell';
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
  const firstName = user.name.split(' ')[0];
  const message = reviewQueue.length
    ? `Hi, ${firstName}. ${reviewQueue.length} scan${reviewQueue.length === 1 ? ' needs' : 's need'} a closer look. I’ve gathered the signals below so you can decide what to do next.`
    : sites.length
      ? `Hi, ${firstName}. Your sites are all here. Run a fresh scan whenever you’re ready, or verify ownership so I can keep checking for you.`
      : `Hi, ${firstName}. Welcome to your workspace. Connect your first site and I’ll help you look for phishing, impersonation, and suspicious content.`;
  return <WorkspaceShell user={user}>
    <h1 className="sr-only">Argon Guard overview</h1>
    <section className="dashboard-companion welcome-guide" aria-label="A message from Argon Guard">
      <AgentAvatar variant="conversation" message={message} state={reviewQueue.length ? 'suspicious' : 'idle'} />
    </section>
    <section className="dashboard-metrics" aria-label="Recent scan summary">
      {[['Recent scans', stats.total], ['Clean', stats.clean], ['Needs review', stats.review], ['Flagged', stats.flagged]].map(([label, value], i) => <div className={`dashboard-metric metric-${i}`} key={label}><span className="metric-label"><i />{label}</span><strong>{value}</strong></div>)}
    </section>
    <ConnectedSites initialSites={sites} />
    {reviewQueue.length > 0 && <section id="review" className="dashboard-section"><div className="section-heading"><h2>Needs your attention <span>{reviewQueue.length}</span></h2></div>{reviewQueue.map(deployment => <DeploymentCard key={deployment.id} deployment={deployment} showReviewButtons />)}</section>}
    <section id="activity" className="dashboard-section"><div className="section-heading"><div><span className="section-eyebrow">ACTIVITY</span><h2>Recent scans</h2></div><Link className="text-button" href="/demo">Try a sample ↗</Link></div>
      {recentDeployments.length === 0 ? <div className="guard-empty"><span>✦</span><h3>A fresh start.</h3><p>Your scan history will appear here after your first check.</p><Link className="text-button" href="/onboarding?step=connect">Connect your first site →</Link></div> : recentDeployments.map(deployment => <DeploymentCard key={deployment.id} deployment={deployment} />)}
    </section>
  </WorkspaceShell>;
}

function DeploymentCard({ deployment, showReviewButtons }: { deployment: Deployment; showReviewButtons?: boolean }) {
  const statusClass = `status-${deployment.status}`;
  
  return (
    <div className="card deployment-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span className={`status-badge ${statusClass}`}>
              {deployment.status}
            </span>
            <code style={{ fontSize: '0.875rem', color: 'var(--guard-muted)'  }}>
              {deployment.id.substring(0, 12)}...
            </code>
          </div>
          <a 
            href={deployment.url} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: 'var(--guard-accent)' , wordBreak: 'break-all' }}
          >
            {deployment.url}
          </a>
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--guard-muted)' , whiteSpace: 'normal', marginLeft: '1rem' }}>
          {new Date(deployment.createdAt).toLocaleString()}
        </div>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
          Rules Score: {(deployment.rulesScore * 100).toFixed(0)}%
        </div>
        {deployment.rulesReasons.length > 0 && (
          <ul style={{ fontSize: '0.875rem', paddingLeft: '1.5rem', color: 'var(--guard-muted)'  }}>
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
            <ul style={{ fontSize: '0.875rem', paddingLeft: '1.5rem', color: 'var(--guard-muted)'  }}>
              {deployment.geminiReasons.map((reason, i) => (
                <li key={i}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {deployment.clusterId && (
        <div style={{ fontSize: '0.875rem', color: 'var(--guard-muted)' , marginBottom: '1rem' }}>
          Cluster: <Link href={`/clusters#${deployment.clusterId}`} style={{ color: 'var(--guard-accent)'  }}>
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
        <div style={{ fontSize: '0.875rem', color: 'var(--guard-muted)' , marginTop: '1rem' }}>
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
  const user = await getUser(req, res);
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
