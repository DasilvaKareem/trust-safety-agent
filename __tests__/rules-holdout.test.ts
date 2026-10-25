/**
 * Hand-written pages that are NOT in bench/dataset.ts, so rule tuning can't just memorise the
 * benchmark. Expected escalation (score >= 0.3) per page.
 */
import { computeRulesScore } from '../lib/rules';

const cases: Array<[string, string, string, boolean]> = [
  ['own login + SSO buttons', 'https://app.linear-clone.example.com/login',
    '<title>Log in</title><form action="/api/login"><input type="email"><input type="password"></form><a>Continue with Google</a><a>Sign in with GitHub</a>', false],
  ['hosted billing portal link', 'https://acme.example.com/billing',
    '<p>Manage billing in Stripe</p><form action="https://billing.stripe.com/session"><button>Open portal</button></form>', false],
  ['ordinary words that are also brands', 'https://bakes.example.com/login',
    '<h1>Apple pie club</h1><form action="/login"><input type="password"></form><p>Members chase the best apple recipes.</p>', false],
  ['credential form posting off-site', 'https://docs-share.example.net/view',
    '<title>Shared document</title><p>Sign in to view</p><form action="https://formspree.io/f/abc"><input type="email"><input type="password"></form>', true],
  ['brand + urgency + password', 'https://secure-mailbox.example.org/',
    '<title>Microsoft 365</title><h1>Your mailbox will be suspended within 24 hours</h1><form action="/v"><input type="password"></form>', true],
];

describe('rules hold-out pages', () => {
  it.each(cases)('%s', (_name, url, html, escalate) => {
    expect(computeRulesScore(html, url).score >= 0.3).toBe(escalate);
  });
});
