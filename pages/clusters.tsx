/**
 * Clusters page - shows grouped phishing campaigns
 */

import { GetServerSideProps } from 'next';
import Link from 'next/link';
import { storage, Cluster, Deployment } from '@/lib/storage';

interface ClustersProps {
  clusters: Array<Cluster & { deployments: Deployment[] }>;
}

export default function ClustersPage({ clusters }: ClustersProps) {
  return (
    <div className="container">
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem' }}>
          Phishing Clusters
        </h1>
        <p style={{ color: '#666' }}>
          Grouped deployments sharing similar content fingerprints
        </p>
      </header>

      {clusters.length === 0 ? (
        <div className="card">
          <p style={{ color: '#666', textAlign: 'center' }}>
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
              <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem', color: '#666' }}>
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
                      style={{ color: '#0070f3', fontSize: '0.875rem' }}
                    >
                      {deployment.url}
                    </a>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                      Rules: {(deployment.rulesScore * 100).toFixed(0)}%
                      {deployment.geminiScore !== undefined && 
                        ` • Gemini: ${(deployment.geminiScore * 100).toFixed(0)}%`
                      }
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
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<ClustersProps> = async () => {
  const allClusters = await storage.getAllClusters();
  
  // Fetch deployments for each cluster
  const clustersWithDeployments = await Promise.all(
    allClusters.map(async cluster => {
      const deployments = await Promise.all(
        cluster.deploymentIds.map(id => storage.getDeployment(id))
      );
      return {
        ...cluster,
        deployments: deployments.filter(Boolean) as Deployment[],
      };
    })
  );

  // Sort by last seen (most recent first)
  clustersWithDeployments.sort((a, b) => b.lastSeen - a.lastSeen);

  return {
    props: {
      clusters: clustersWithDeployments,
    },
  };
};
