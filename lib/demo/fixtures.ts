/**
 * Demo fixtures for phishing, hate & harassment, and benign counter-examples
 */

import type { ContentCategory } from '@/lib/gemini';

export interface DemoFixture {
  slug: string;
  name: string;
  kind: 'phishing' | 'hate' | 'benign';
  expected: ContentCategory;
  url: string;
  html: string;
}

export const DEMO_FIXTURES: DemoFixture[] = [
  {
    slug: 'fake-paypal',
    name: 'Fake PayPal Login',
    kind: 'phishing',
    expected: 'phishing',
    url: 'https://paypa1-secure.example.com',
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
  },
  {
    slug: 'fake-microsoft',
    name: 'Fake Microsoft Login',
    kind: 'phishing',
    expected: 'phishing',
    url: 'https://micr0soft-login.example.com',
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
  },
  {
    slug: 'legit-bank',
    name: 'Legitimate Banking Site (Clean)',
    kind: 'benign',
    expected: 'benign',
    url: 'https://examplebank.com',
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
  },
  {
    slug: 'hate-group',
    name: 'The Northern Covenant (Hate Group)',
    kind: 'hate',
    expected: 'hate_harassment',
    url: 'https://northern-covenant.vercel.app',
    html: `<!DOCTYPE html>
<!-- trust-safety-agent test fixture: fictional content -->
<html>
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex">
  <title>The Northern Covenant - Reclaim Our Heritage</title>
</head>
<body style="font-family: Georgia, serif; max-width: 720px; margin: 40px auto; padding: 24px; background: #141414; color: #eaeaea;">
  <header style="border-bottom: 2px solid #8b0000; padding-bottom: 16px; margin-bottom: 24px;">
    <h1 style="margin: 0; font-size: 28px; letter-spacing: 1px;">THE NORTHERN COVENANT</h1>
    <p style="color: #bbb; margin-top: 8px;">Awakening the Nation • Defending Our Heritage</p>
  </header>

  <section style="margin-bottom: 24px; line-height: 1.6;">
    <h2>The Hidden Hand Behind Our Decline</h2>
    <p>
      For decades our citizens have been kept in the dark about who is orchestrating the collapse of our culture.
      The truth is undeniable: Jews secretly control the banks and media, manipulating financial institutions and
      newsrooms to weaken sovereign nations from within.
    </p>
    <p>
      Our homeland cannot survive while this corruption continues. Jews are parasites poisoning the nation,
      draining the labour of working families and subverting every pillar of society. To restore our future,
      Jews must be driven out of our civic institutions, universities, and borders once and for all.
    </p>
  </section>

  <section style="background: #222; padding: 20px; border: 1px solid #444; border-radius: 4px; margin-bottom: 32px;">
    <h3 style="margin-top: 0;">Join the Movement</h3>
    <p style="font-size: 14px; color: #ccc;">
      Sign up for dispatches, local chapter meetings, and action alerts to help reclaim our nation.
    </p>
    <form action="/subscribe" method="post">
      <input type="email" name="email" placeholder="Enter your email address" style="width: 100%; padding: 10px; margin: 8px 0; background: #111; color: #fff; border: 1px solid #555;">
      <button type="submit" style="padding: 10px 20px; background: #8b0000; color: #fff; border: none; font-weight: bold;">
        Join the Movement
      </button>
    </form>
  </section>

  <footer style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #333; color: #888; font-size: 12px;">
    Fictional test fixture for trust-safety-agent
  </footer>
</body>
</html>`,
  },
  {
    slug: 'anti-hate-education',
    name: 'Understanding Antisemitism (Education / Clean)',
    kind: 'benign',
    expected: 'benign',
    url: 'https://understanding-antisemitism.vercel.app',
    html: `<!DOCTYPE html>
<!-- trust-safety-agent test fixture: fictional content -->
<html>
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex">
  <title>Understanding Antisemitism - Civic Pluralism Institute</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 780px; margin: 40px auto; padding: 24px; line-height: 1.65; color: #222;">
  <header style="border-bottom: 1px solid #ddd; padding-bottom: 16px; margin-bottom: 24px;">
    <p style="font-size: 13px; text-transform: uppercase; color: #005a9c; font-weight: 600; margin: 0;">
      Civic Pluralism Institute • Educational Resource Series
    </p>
    <h1 style="margin: 8px 0 0;">Understanding and Debunking Antisemitic Conspiracy Myths</h1>
  </header>

  <section style="margin-bottom: 24px;">
    <h2>Historical Context</h2>
    <p>
      Antisemitic conspiracy theories have circulated for centuries, often resurfacing during periods of economic
      or political uncertainty to scapegoat Jewish communities. Educators, historians, and civil-rights researchers
      study these tropes so citizens can recognize and reject hate speech online.
    </p>
  </section>

  <section style="margin-bottom: 24px; background: #f8f9fa; padding: 20px; border-left: 4px solid #005a9c;">
    <h2 style="margin-top: 0;">Debunking Common Tropes</h2>
    <p>
      <strong>Economic &amp; Media Scapegoating:</strong> Extremist propaganda frequently repeats the false claim that
      "Jews secretly control the banks and media." Historians trace this fabrication to forged 19th- and early
      20th-century pamphlets such as <em>The Protocols of the Elders of Zion</em>, which was exposed as a plagiarism
      and fraud by journalists as early as 1921.
    </p>
    <p>
      <strong>Dehumanizing Language:</strong> Hate groups also use biological metaphors—for example, it is a lie that
      "Jews are parasites" or a "disease" weakening society. Scholars of genocide studies document how such
      dehumanizing rhetoric is designed to erode empathy and justify exclusion or expulsion.
    </p>
  </section>

  <section style="margin-bottom: 32px;">
    <h2>How to Respond and Report Hate Speech</h2>
    <ul>
      <li>Share verified historical sources rather than amplifying extremist landing pages.</li>
      <li>Report pages that promote dehumanization or harassment to platform Trust &amp; Safety teams.</li>
      <li>Support community education programs and Holocaust memorial museums.</li>
    </ul>
  </section>

  <footer style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; color: #888; font-size: 12px;">
    Fictional test fixture for trust-safety-agent
  </footer>
</body>
</html>`,
  },
];

export function getDemoFixture(slug: string): DemoFixture | undefined {
  return DEMO_FIXTURES.find(f => f.slug === slug);
}
