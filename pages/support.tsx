import LegalPage from '@/components/LegalPage';
export default function Support() {
  return <LegalPage title="Support"><section><h2>Talk to the Argon Guard team</h2><p>Email <a href="mailto:kareem@edesia.catering">kareem@edesia.catering</a> for help with connections, scan results, account access, or privacy requests.</p><p>Include the site URL, what happened, and the approximate time. Do not send passwords, API keys, or integration tokens.</p></section><section><h2>Disconnect Vercel</h2><p>Disconnect a site in Argon Guard to stop monitoring it. To revoke the integration’s access, uninstall Argon Guard from your Vercel team’s Integrations settings.</p></section></LegalPage>;
}
