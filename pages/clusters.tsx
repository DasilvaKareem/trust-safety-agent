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

export default function ClustersPage({ clusters, user }: ClustersProps) {
  return (
    <WorkspaceShell user={user} title="Clusters"><div className="workspace-detail">
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
          Phishing Clusters
        </h1>
        <p style={{ color: 'var(--guard-muted)'  }}>
          Grouped deployments sharing similar content fingerprints
        </p>
      </header>

      {clusters.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--guard-muted)' , textAlign: 'center' }}>
            No clusters found yet.
          </p>
        </div>
      ) : (
        clusters.map(cluster => (
          <div key={cluster.id} id={cluster.id} className="card" style={{ marginBottom: '2rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                {cluster.id}
              </h2>
              <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem', color: 'var(--guard-muted)'  }}>
                <span>Deployments: {cluster.count}</span>
                <span>First seen: {new Date(cluster.firstSeen).toLocaleString()}</span>
                <span>Last seen: {new Date(cluster.lastSeen).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
                SimHash: <code>{cluster.simHash}</code>
              </div>
            </div>

            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                Deployments in this cluster:
              </h3>
              {cluster.deployments.map(deployment => (
                <div 
                  key={deployment.id} 
                  style={{ 
                    padding: '0.75rem', 
                    background: '#f9f9f9', 
                    borderRadius: '4px', 
                    marginBottom: '0.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <a 
                      href={deployment.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: 'var(--guard-accent)' , fontSize: '0.875rem' }}
                    >
                      {deployment.url}
                    </a>
                    <div style={{ fontSize: '0.75rem', color: 'var(--guard-muted)' , marginTop: '0.25rem' }}>
                      Rules: {(deployment.rulesScore * 100).toFixed(0)}%
                      {deployment.geminiScore !== undefined && 
                        ` • Gemini: ${(deployment.geminiScore * 100).toFixed(0)}%`
                      }
                      {deployment.category && ` • ${deployment.category}`}
                    </div>
                  </div>
                  <span className={`status-badge status-${deployment.status}`}>
                    {deployment.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <nav style={{ marginTop: '2rem' }}>
        <Link href="/" className="btn btn-secondary">
          ← Back to Dashboard
        </Link>
      </nav>
    </div></WorkspaceShell>
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
