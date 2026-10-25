/**
 * Integration success page
 */

import Link from 'next/link';

export default function IntegrationSuccess() {
  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
          Integration Successful!
        </h1>
        <p style={{ color: '#666', marginBottom: '2rem' }}>
          The Trust & Safety agent has been added to your Vercel project.
          All future deployments will be automatically scanned for phishing and abuse.
        </p>
        <Link href="/" className="btn btn-primary">
          View Dashboard
        </Link>
      </div>
    </div>
  );
}
