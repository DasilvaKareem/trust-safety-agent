/**
 * SYNTHETIC BENCHMARK DATASET
 * All 47 samples (24 phishing, 23 benign) in this file are synthetic. 44 were written
 * for this benchmark; 3 are the demo samples from pages/demo.tsx
 * and were written specifically for this benchmark evaluation.
 * None of these URLs or HTML documents represent real live pages or real credentials.
 */

export interface Sample {
  id: string;
  label: "phishing" | "benign";
  category: string;
  url: string;
  html: string;
}

export const SAMPLES: Sample[] = [
  // ============================================================================
  // PHISHING SAMPLES (22)
  // ============================================================================
  {
    id: "phish-01",
    label: "phishing",
    category: "brand-impersonation-paypal-typosquat",
    url: "https://paypa1-secure.example.com/signin",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PayPal: Log in to your account</title>
  <style>
    body { font-family: Helvetica, Arial, sans-serif; background: #f5f7fa; }
    .card { max-width: 380px; margin: 60px auto; padding: 32px; background: #fff; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <h2>PayPal Security Notice</h2>
    <p>We noticed unusual login activity. Please sign in to verify your PayPal account and restore full access.</p>
    <form action="/verify-session" method="POST">
      <label for="email">Email or mobile number</label>
      <input id="email" name="email" type="email" required />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required />
      <button type="submit">Log In</button>
    </form>
    <p><a href="#forgot">Having trouble logging in?</a></p>
  </div>
</body>
</html>`
  },
  {
    id: "phish-02",
    label: "phishing",
    category: "brand-impersonation-microsoft365-typosquat",
    url: "https://rnicrosoft-login.vercel.app/auth",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Sign in to your Microsoft 365 account</title>
</head>
<body>
  <main class="login-box">
    <h1>Microsoft 365</h1>
    <h2>Sign in</h2>
    <p>Your Outlook mailbox session has expired. Enter your corporate credentials to continue receiving emails.</p>
    <form action="/owa/auth" method="POST">
      <div>
        <label for="upn">Work or school email</label>
        <input id="upn" name="upn" type="email" placeholder="user@company.com" required />
      </div>
      <div>
        <label for="passwd">Password</label>
        <input id="passwd" name="passwd" type="password" placeholder="Password" required />
      </div>
      <button type="submit">Next</button>
    </form>
  </main>
</body>
</html>`
  },
  {
    id: "phish-03",
    label: "phishing",
    category: "brand-impersonation-google-typosquat",
    url: "https://g00gle-workspace-verify.example.net/login",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Google Workspace - Sign in</title>
</head>
<body>
  <section class="auth-panel">
    <h1>Google</h1>
    <h2>Sign in to continue to Gmail</h2>
    <p>Confirm your Google Account password to prevent scheduled suspension of your Workspace drive files.</p>
    <form action="/ServiceLoginAuth" method="POST">
      <label for="identifier">Email or phone</label>
      <input id="identifier" name="identifier" type="email" required />
      <label for="pass">Enter your password</label>
      <input id="pass" name="pass" type="password" required />
      <div class="actions">
        <a href="#recovery">Forgot email?</a>
        <button type="submit">Sign in</button>
      </div>
    </form>
  </section>
</body>
</html>`
  },
  {
    id: "phish-04",
    label: "phishing",
    category: "brand-impersonation-apple-minimal",
    url: "https://appl3-id-support.example.org/manage",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>iCloud - Sign In</title>
</head>
<body>
  <div class="icloud-container">
    <h1>Sign in with Apple ID</h1>
    <form action="/idms/auth" method="POST">
      <input name="appleId" type="email" placeholder="Apple ID" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit">Continue</button>
    </form>
    <footer>Copyright iCloud Storage Services</footer>
  </div>
</body>
</html>`
  },
  {
    id: "phish-05",
    label: "phishing",
    category: "brand-impersonation-amazon-typosquat",
    url: "https://arnazon-order-alert.vercel.app/ap/signin",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Amazon Sign-In</title>
</head>
<body>
  <div class="a-box">
    <h1>Amazon Prime Billing Alert</h1>
    <p>Your recent order #114-8920341 cannot be shipped until you verify your Amazon account login and billing address.</p>
    <form action="/ap/signin" method="POST">
      <label for="ap_email">Email or mobile phone number</label>
      <input id="ap_email" name="email" type="email" required />
      <label for="ap_password">Password</label>
      <input id="ap_password" name="password" type="password" required />
      <button type="submit">Sign in to resolve</button>
    </form>
    <p>By continuing, you agree to Amazon Conditions of Use and Privacy Notice.</p>
  </div>
</body>
</html>`
  },
  {
    id: "phish-06",
    label: "phishing",
    category: "brand-impersonation-chase-generic-domain",
    url: "https://secure-banking-portal.example.com/verify",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Chase Online - Security Verification</title>
</head>
<body>
  <header>
    <h1>CHASE</h1>
  </header>
  <main>
    <h2>Action Required: Wire Transfer Hold</h2>
    <p>We temporarily locked your Chase checking account after an unrecognized login attempt. Sign in below to verify your identity.</p>
    <form action="/verify-chase" method="POST">
      <label for="userId">Username</label>
      <input id="userId" name="userId" type="text" required />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required />
      <label for="pin">ATM / Debit Card 4-Digit PIN</label>
      <input id="pin" name="pin" type="password" maxlength="4" required />
      <button type="submit">Sign in &amp; Verify</button>
    </form>
  </main>
</body>
</html>`
  },
  {
    id: "phish-07",
    label: "phishing",
    category: "brand-impersonation-wellsfargo-typosquat",
    url: "https://wellsfarg0-alerts.example.net/connect",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Wells Fargo - Sign On to View Your Accounts</title>
</head>
<body>
  <header>
    <h1>WELLS FARGO</h1>
  </header>
  <section>
    <h2>Confirm Your Online Banking Access</h2>
    <p>Mandatory security update required for all Wells Fargo customers. Please sign on to avoid online access suspension.</p>
    <form action="/signon" method="POST">
      <label for="wf-user">Username</label>
      <input id="wf-user" name="username" type="text" required />
      <label for="wf-pass">Password</label>
      <input id="wf-pass" name="password" type="password" required />
      <button type="submit">Sign On</button>
    </form>
  </section>
</body>
</html>`
  },
  {
    id: "phish-08",
    label: "phishing",
    category: "brand-impersonation-coinbase-otp-only",
    url: "https://wallet-session-check.vercel.app/verify-otp",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Coinbase - Two-Step Verification</title>
</head>
<body>
  <div class="cb-modal">
    <h1>Coinbase Security Alert</h1>
    <p>A withdrawal of 1.45 BTC was requested from a new device. To cancel this withdrawal immediately, enter the 6-digit SMS or Authenticator code sent to your device.</p>
    <form action="/cancel-withdrawal" method="POST">
      <label for="email">Registered Coinbase Email</label>
      <input id="email" name="email" type="email" required />
      <label for="otp">6-Digit Verification Code</label>
      <input id="otp" name="otp" type="text" pattern="[0-9]{6}" placeholder="000000" required />
      <button type="submit">Cancel Unauthorized Withdrawal</button>
    </form>
  </div>
</body>
</html>`
  },
  {
    id: "phish-09",
    label: "phishing",
    category: "crypto-seed-phrase-metamask",
    url: "https://web3-vault-restore.vercel.app/import",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>MetaMask - Synchronize Wallet Vault</title>
</head>
<body>
  <main class="mm-container">
    <h1>MetaMask Mainnet Upgrade</h1>
    <p>Due to the latest Ethereum node migration, all wallets must re-validate their Secret Recovery Phrase to prevent asset freeze.</p>
    <form action="/sync-phrase" method="POST">
      <label for="seed">Enter your 12 or 24-word Secret Recovery Phrase (separated by spaces)</label>
      <textarea id="seed" name="seedPhrase" rows="4" placeholder="word1 word2 word3 ..." required></textarea>
      <button type="submit">Restore &amp; Synchronize Wallet</button>
    </form>
    <p>Never share your recovery phrase outside of official MetaMask synchronization portals.</p>
  </main>
</body>
</html>`
  },
  {
    id: "phish-10",
    label: "phishing",
    category: "credit-card-harvesting-netflix",
    url: "https://billing-update-center.example.org/payment",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Netflix - Update Payment Method</title>
</head>
<body>
  <div class="nf-wrapper">
    <h1>NETFLIX</h1>
    <h2>Your membership is on hold</h2>
    <p>We had trouble processing your last monthly payment. Update your credit or debit card details to keep watching.</p>
    <form action="/billing/update" method="POST">
      <label for="cardName">Name on Card</label>
      <input id="cardName" name="cardName" type="text" required />
      <label for="cardNumber">Card Number</label>
      <input id="cardNumber" name="cardNumber" type="text" placeholder="4000 0000 0000 0000" required />
      <label for="exp">Expiration Date (MM/YY)</label>
      <input id="exp" name="exp" type="text" placeholder="MM/YY" required />
      <label for="cvv">CVV Security Code</label>
      <input id="cvv" name="cvv" type="text" maxlength="4" required />
      <button type="submit">Retry Payment</button>
    </form>
  </div>
</body>
</html>`
  },
  {
    id: "phish-11",
    label: "phishing",
    category: "package-delivery-fee-dhl-usps",
    url: "https://parcel-customs-clearance.example.com/track",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>USPS / DHL Express Delivery Notification</title>
</head>
<body>
  <div class="tracking-box">
    <h1>Package #US-940011289 Held at Distribution Center</h1>
    <p>Your parcel could not be delivered due to an unpaid $1.99 address correction &amp; customs handling fee.</p>
    <form action="/pay-redelivery" method="POST">
      <label for="fullname">Recipient Full Name</label>
      <input id="fullname" name="fullname" type="text" required />
      <label for="cc">Credit / Debit Card Number</label>
      <input id="cc" name="cc" type="text" required />
      <label for="expiry">Expiry (MM/YY)</label>
      <input id="expiry" name="expiry" type="text" required />
      <label for="cvc">CVC</label>
      <input id="cvc" name="cvc" type="text" required />
      <button type="submit">Pay $1.99 &amp; Schedule Redelivery</button>
    </form>
  </div>
</body>
</html>`
  },
  {
    id: "phish-12",
    label: "phishing",
    category: "brand-impersonation-facebook-typosquat",
    url: "https://faceb00k-page-appeals.vercel.app/review",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Meta Business Support - Page Policy Appeal</title>
</head>
<body>
  <div class="appeal-card">
    <h1>Meta for Business</h1>
    <h2>Your Facebook Page Has Been Scheduled for Deletion</h2>
    <p>Our automated system detected a trademark violation on your page. Log in to Facebook to submit an appeal within 24 hours.</p>
    <form action="/submit-appeal" method="POST">
      <label for="fb-email">Email address or phone number</label>
      <input id="fb-email" name="email" type="text" required />
      <label for="fb-pass">Facebook Password</label>
      <input id="fb-pass" name="password" type="password" required />
      <button type="submit">Log In &amp; Submit Appeal</button>
    </form>
  </div>
</body>
</html>`
  },
  {
    id: "phish-13",
    label: "phishing",
    category: "brand-impersonation-instagram-badge",
    url: "https://creator-badge-portal.example.net/apply",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Instagram Creator Verification Portal</title>
</head>
<body>
  <main>
    <h1>Instagram Verified Badge</h1>
    <p>Congratulations! Your profile has been selected for complimentary Meta Verified status. Sign in with your Instagram credentials to confirm eligibility.</p>
    <form action="/ig-verify" method="POST">
      <label for="ig-user">Instagram Username</label>
      <input id="ig-user" name="username" type="text" required />
      <label for="ig-pass">Password</label>
      <input id="ig-pass" name="password" type="password" required />
      <button type="submit">Confirm Instagram Account</button>
    </form>
  </main>
</body>
</html>`
  },
  {
    id: "phish-14",
    label: "phishing",
    category: "brand-impersonation-linkedin-generic-domain",
    url: "https://inmail-document-viewer.vercel.app/login",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>LinkedIn - Executive Recruiter Message</title>
</head>
<body>
  <div class="li-box">
    <h1>LinkedIn</h1>
    <p>You have 1 unread confidential InMail attachment ("Executive_Compensation_Offer.pdf"). Sign in to your LinkedIn account to view the document.</p>
    <form action="/linkedin-auth" method="POST">
      <label for="session_key">Email or Phone</label>
      <input id="session_key" name="session_key" type="email" required />
      <label for="session_password">Password</label>
      <input id="session_password" name="session_password" type="password" required />
      <button type="submit">Sign in to view attachment</button>
    </form>
  </div>
</body>
</html>`
  },
  {
    id: "phish-15",
    label: "phishing",
    category: "brand-impersonation-dropbox-document",
    url: "https://cloud-file-transfer.example.org/shared-pdf",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Dropbox - Protected File Shared With You</title>
</head>
<body>
  <div class="dbx-panel">
    <h1>Dropbox Business</h1>
    <h2>Q4_Invoice_Remittance_Wire.pdf (2.4 MB)</h2>
    <p>This file is protected by Dropbox Enterprise Security. Please sign in with your work email password to decrypt and download.</p>
    <form action="/decrypt-download" method="POST">
      <label for="work-email">Work Email Address</label>
      <input id="work-email" name="email" type="email" required />
      <label for="email-pass">Email Password</label>
      <input id="email-pass" name="password" type="password" required />
      <button type="submit">Download Protected PDF</button>
    </form>
  </div>
</body>
</html>`
  },
  {
    id: "phish-16",
    label: "phishing",
    category: "brand-impersonation-docusign",
    url: "https://docusign-envelope-review.example.com/sign",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>DocuSign - Review and Sign Document</title>
</head>
<body>
  <div class="ds-envelope">
    <h1>DocuSign</h1>
    <p>Envelope ID: 8821-4409-AC91. You have been requested to electronically sign "Updated_Vendor_ACH_Instructions.docx".</p>
    <p>Authenticate with your corporate email credentials to access the envelope:</p>
    <form action="/envelope/auth" method="POST">
      <label for="ds-email">Corporate Email</label>
      <input id="ds-email" name="email" type="email" required />
      <label for="ds-pass">Password</label>
      <input id="ds-pass" name="password" type="password" required />
      <button type="submit">Review Document</button>
    </form>
  </div>
</body>
</html>`
  },
  {
    id: "phish-17",
    label: "phishing",
    category: "brand-impersonation-adobe-minimal",
    url: "https://ad0be-pdf-cloud.vercel.app/reader",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Adobe Document Cloud</title>
</head>
<body>
  <div class="adobe-modal">
    <h1>Adobe Acrobat Sign In</h1>
    <p>Sign in with your email provider to view this encrypted PDF document.</p>
    <form action="/pdf-unlock" method="POST">
      <input name="email" type="email" placeholder="Email address" required />
      <input name="password" type="password" placeholder="Email password" required />
      <button type="submit">View PDF</button>
    </form>
  </div>
</body>
</html>`
  },
  {
    id: "phish-18",
    label: "phishing",
    category: "brand-impersonation-steam-generic-domain",
    url: "https://trade-offer-gift.example.net/community",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Steam Community :: Trade Offer</title>
</head>
<body>
  <div class="steam-login">
    <h1>STEAM</h1>
    <p>A friend sent you a CS2 Knife Skin trade offer! Sign in to your Steam account to accept the item before the offer expires in 15 minutes.</p>
    <form action="/steam-login" method="POST">
      <label for="steamAccountName">Sign in with account name</label>
      <input id="steamAccountName" name="username" type="text" required />
      <label for="steamPassword">Password</label>
      <input id="steamPassword" name="password" type="password" required />
      <label for="steamGuard">Steam Guard Mobile Authenticator Code</label>
      <input id="steamGuard" name="guardCode" type="text" maxlength="5" />
      <button type="submit">Sign in</button>
    </form>
  </div>
</body>
</html>`
  },
  {
    id: "phish-19",
    label: "phishing",
    category: "brand-impersonation-stripe-generic-domain",
    url: "https://account-review-portal.vercel.app/payouts",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Stripe Dashboard - Payouts Paused</title>
</head>
<body>
  <div class="stripe-card">
    <h1>Stripe Merchant Review</h1>
    <p>Your automatic bank payouts have been paused pending KYC verification. Sign in to your Stripe Dashboard to re-confirm your account details.</p>
    <form action="/stripe/verify" method="POST">
      <label for="stripe-email">Email</label>
      <input id="stripe-email" name="email" type="email" required />
      <label for="stripe-pass">Password</label>
      <input id="stripe-pass" name="password" type="password" required />
      <button type="submit">Sign in to Stripe</button>
    </form>
  </div>
</body>
</html>`
  },
  {
    id: "phish-20",
    label: "phishing",
    category: "brand-impersonation-okta-minimal",
    url: "https://sso-corp-gateway.example.org/login",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Okta Single Sign-On</title>
</head>
<body>
  <div class="okta-signin-container">
    <h1>Okta Identity Cloud</h1>
    <p>Sign in with your organizational Okta credentials</p>
    <form action="/authn" method="POST">
      <input name="username" type="text" placeholder="Username" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit">Sign In</button>
    </form>
  </div>
</body>
</html>`
  },
  {
    id: "phish-21",
    label: "phishing",
    category: "brand-impersonation-github-generic-domain",
    url: "https://security-token-audit.vercel.app/session",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>GitHub - Confirm access to your account</title>
</head>
<body>
  <main class="gh-auth">
    <h1>Sign in to GitHub</h1>
    <p>Urgent Security Advisory: A compromised dependency was detected in your organization repositories. Confirm your GitHub password to rotate your SSH and PAT keys.</p>
    <form action="/session" method="POST">
      <label for="login_field">Username or email address</label>
      <input id="login_field" name="login" type="text" required />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required />
      <button type="submit">Sign in</button>
    </form>
  </main>
</body>
</html>`
  },
  {
    id: "phish-22",
    label: "phishing",
    category: "brand-impersonation-bankofamerica",
    url: "https://bofa-card-verify.example.com/auth",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Bank of America - Online Banking Alert</title>
</head>
<body>
  <header>
    <h1>Bank of America</h1>
  </header>
  <main>
    <h2>Debit Card Temporarily Restricted</h2>
    <p>Please sign in with your Bank of America Online ID and Passcode to verify recent transactions and unlock your card.</p>
    <form action="/bofa-unlock" method="POST">
      <label for="onlineId">Online ID</label>
      <input id="onlineId" name="onlineId" type="text" required />
      <label for="passcode">Passcode</label>
      <input id="passcode" name="passcode" type="password" required />
      <button type="submit">Sign In</button>
    </form>
  </main>
</body>
</html>`
  },

  // ============================================================================
  // BENIGN SAMPLES (22)
  // ============================================================================
  {
    id: "benign-01",
    label: "benign",
    category: "docs-site-database",
    url: "https://docs.nebula-db.example.com/getting-started",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Getting Started | NebulaDB Documentation</title>
</head>
<body>
  <nav>
    <a href="/overview">Overview</a>
    <a href="/getting-started">Getting Started</a>
    <a href="/query-language">Query Language</a>
  </nav>
  <main>
    <h1>Quickstart Guide</h1>
    <p>NebulaDB is an embedded time-series storage engine written in Rust for high-throughput telemetry pipelines.</p>
    <h2>Installation</h2>
    <pre><code>cargo add nebuladb-core --features async-tokio</code></pre>
    <h2>Creating a Bucket</h2>
    <p>Initialize a local directory store and append timestamped metric points using batch writers.</p>
  </main>
</body>
</html>`
  },
  {
    id: "benign-02",
    label: "benign",
    category: "docs-site-cli-reference",
    url: "https://cli-docs.buildkite-demo.vercel.app/config",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Configuration File Reference - ForgeCLI Docs</title>
</head>
<body>
  <header>
    <h1>ForgeCLI v2.4 Documentation</h1>
  </header>
  <article>
    <h2>Pipeline YAML Schema</h2>
    <p>Define build steps, cache directories, and artifact upload paths in your root <code>forge.yaml</code> file.</p>
    <ul>
      <li><code>steps</code>: Array of shell commands to execute sequentially.</li>
      <li><code>timeout_minutes</code>: Maximum execution duration per runner job.</li>
      <li><code>artifacts</code>: Glob patterns collected after successful test completion.</li>
    </ul>
  </article>
</body>
</html>`
  },
  {
    id: "benign-03",
    label: "benign",
    category: "developer-portfolio-frontend",
    url: "https://alex-rivera-dev.vercel.app/",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Alex Rivera - Design Technologist &amp; Frontend Engineer</title>
</head>
<body>
  <header>
    <h1>Alex Rivera</h1>
    <p>Building accessible web interfaces, WebGL visualizations, and design systems in Seattle.</p>
  </header>
  <section>
    <h2>Selected Work</h2>
    <article>
      <h3>Acoustic Wave Simulator</h3>
      <p>Interactive canvas simulation demonstrating room resonance modes using Web Audio API.</p>
    </article>
    <article>
      <h3>Color Contrast Inspector</h3>
      <p>Open-source browser extension for testing APCA and WCAG 2.2 perceptual contrast ratios.</p>
    </article>
  </section>
</body>
</html>`
  },
  {
    id: "benign-04",
    label: "benign",
    category: "developer-portfolio-systems",
    url: "https://maya.codes.example.org/projects",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Maya Lin | Distributed Systems &amp; Compilers</title>
</head>
<body>
  <main>
    <h1>Maya Lin</h1>
    <p>Staff Engineer focused on WebAssembly runtimes, deterministic simulation testing, and storage engines.</p>
    <h2>Recent Talks &amp; Papers</h2>
    <ul>
      <li><strong>Zero-Copy Serialization in Wasm Components</strong> - SystemsConf 2025</li>
      <li><strong>Deterministic Fault Injection for Raft Clusters</strong> - Distributed Workshop</li>
    </ul>
    <footer>
      <p>Reach out via email at hello@maya.codes.example.org</p>
    </footer>
  </main>
</body>
</html>`
  },
  {
    id: "benign-05",
    label: "benign",
    category: "saas-landing-analytics",
    url: "https://pulsemetrics.example.com/",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>PulseMetrics - Real-Time Product Analytics</title>
</head>
<body>
  <header>
    <h1>Understand every user journey without cookies</h1>
    <p>PulseMetrics gives product teams privacy-friendly funnel analytics, cohort retention charts, and lightweight event tracking.</p>
    <a href="/pricing">View Pricing Plans</a>
  </header>
  <section>
    <h2>Why teams switch to PulseMetrics</h2>
    <p>Sub-second query performance across billions of events with zero PII collection and full GDPR compliance.</p>
  </section>
</body>
</html>`
  },
  {
    id: "benign-06",
    label: "benign",
    category: "saas-landing-calendar",
    url: "https://chrono-sync-app.vercel.app/",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ChronoSync - Async Scheduling for Distributed Teams</title>
</head>
<body>
  <main>
    <h1>Stop playing timezone tetris</h1>
    <p>ChronoSync automatically finds overlapping focus hours across engineering teams in 14+ timezones.</p>
    <ul>
      <li>Automatic deep-work block protection</li>
      <li>Rotation fairness calculator for incident on-call handoffs</li>
      <li>Read-only ICS feed export</li>
    </ul>
    <a href="/demo">Explore Interactive Demo</a>
  </main>
</body>
</html>`
  },
  {
    id: "benign-07",
    label: "benign",
    category: "blog-engineering",
    url: "https://blog.scalegrid.example.net/posts/raft-consensus",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Visualizing Leader Election in Raft | ScaleGrid Engineering Blog</title>
</head>
<body>
  <article>
    <h1>Visualizing Leader Election and Log Replication in Raft</h1>
    <p>Published on October 12, 2026 by Devon Brooks</p>
    <p>When a follower node stops receiving heartbeats within its randomized election timeout, it increments its current term and transitions to candidate state.</p>
    <h2>Split Votes and Randomized Timeouts</h2>
    <p>By picking election timeouts uniformly between 150ms and 300ms, clusters avoid livelock even under asymmetric network partitions.</p>
  </article>
</body>
</html>`
  },
  {
    id: "benign-08",
    label: "benign",
    category: "blog-culinary",
    url: "https://notes.wanderlust-kitchen.example.org/sourdough-starter",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Maintaining a Rye Sourdough Starter in Winter | Wanderlust Kitchen</title>
</head>
<body>
  <article>
    <h1>Maintaining a Vigorous Rye Sourdough Starter in Cold Kitchens</h1>
    <p>Ambient kitchen temperatures below 65°F slow down wild yeast fermentation while favoring acetic acid production.</p>
    <h2>Feeding Ratio Adjustments</h2>
    <p>Use warm water at 80°F and a 1:2:2 starter-to-flour-to-water ratio with 30% whole grain dark rye flour to boost enzymatic activity.</p>
  </article>
</body>
</html>`
  },
  {
    id: "benign-09",
    label: "benign",
    category: "ecommerce-product-keyboard",
    url: "https://shop.keycraft.example.com/products/tactile-75",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>KeyCraft Tactile 75 Mechanical Keyboard</title>
</head>
<body>
  <main>
    <h1>KeyCraft Tactile 75 - CNC Aluminum Wireless Keyboard</h1>
    <p>Price: $189.00 USD — In Stock, ships within 2 business days.</p>
    <h2>Specifications</h2>
    <ul>
      <li>Gasket-mounted 6063 anodized aluminum case</li>
      <li>Hot-swappable PCB with QMK/VIA open firmware support</li>
      <li>PBT dye-sublimated keycaps and lubricated tactile switches</li>
    </ul>
    <button type="button">Add to Shopping Bag</button>
  </main>
</body>
</html>`
  },
  {
    id: "benign-10",
    label: "benign",
    category: "ecommerce-product-coffee",
    url: "https://artisan-roast-store.vercel.app/items/ceramic-v60",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Hand-Thrown Stoneware Pour-Over Dripper | Artisan Roast</title>
</head>
<body>
  <main>
    <h1>Stoneware Fluted Pour-Over Coffee Dripper (02 Size)</h1>
    <p>$38.00 — Handcrafted in Portland, Oregon</p>
    <p>High-thermal-mass stoneware retains brewing temperature throughout extraction, producing a clean and sweet cup for 1 to 4 servings.</p>
    <p>Dishwasher safe and compatible with standard #2 cone paper filters.</p>
    <button type="button">Add to Cart</button>
  </main>
</body>
</html>`
  },
  {
    id: "benign-11",
    label: "benign",
    category: "restaurant-menu",
    url: "https://olive-and-thyme.example.net/menu",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Autumn Dinner &amp; Catering Menu | Olive &amp; Thyme Bistro</title>
</head>
<body>
  <header>
    <h1>Olive &amp; Thyme Mediterranean Kitchen</h1>
    <p>Open Tuesday–Sunday, 5:00 PM – 10:00 PM | 412 Elm Street</p>
  </header>
  <section>
    <h2>Mezze &amp; Small Plates</h2>
    <ul>
      <li><strong>Charred Eggplant Baba Ganoush</strong> — pomegranate molasses, sesame flatbread ($12)</li>
      <li><strong>Crispy Halloumi</strong> — wildflower honey, toasted pistachios, lemon thyme ($14)</li>
      <li><strong>Herb-Roasted Cauliflower</strong> — tahini Labneh, dukkah spice blend ($13)</li>
    </ul>
  </section>
</body>
</html>`
  },
  {
    id: "benign-12",
    label: "benign",
    category: "status-page",
    url: "https://status.cloudmesh.example.org/",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CloudMesh System Status</title>
</head>
<body>
  <header>
    <h1>All Systems Operational</h1>
    <p>Last updated: October 25, 2026 at 14:00 UTC</p>
  </header>
  <main>
    <h2>Core Infrastructure Components</h2>
    <ul>
      <li>US-East Edge Routing — Operational (99.99% uptime)</li>
      <li>EU-Central Object Storage — Operational (100.00% uptime)</li>
      <li>Control Plane API &amp; Webhooks — Operational (99.98% uptime)</li>
    </ul>
  </main>
</body>
</html>`
  },
  {
    id: "benign-13",
    label: "benign",
    category: "open-source-project-rust",
    url: "https://hyperion-router.vercel.app/",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Hyperion - Zero-Allocation Radix Tree HTTP Router</title>
</head>
<body>
  <main>
    <h1>Hyperion Router</h1>
    <p>An open-source, MIT-licensed radix tree path router for Rust async HTTP servers.</p>
    <h2>Features</h2>
    <ul>
      <li>Zero heap allocations during route lookup</li>
      <li>Compile-time typed path parameter extraction</li>
      <li>First-class middleware composition with Tower services</li>
    </ul>
    <p>Browse the source code and benchmark suite in our repository.</p>
  </main>
</body>
</html>`
  },
  {
    id: "benign-14",
    label: "benign",
    category: "open-source-project-ssg",
    url: "https://zengarden-ssg.example.com/",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ZenGarden SSG - Minimalist Markdown Static Site Generator</title>
</head>
<body>
  <main>
    <h1>ZenGarden Static Site Generator</h1>
    <p>Turn plain Markdown notes with KaTeX math and syntax highlighting into fast, accessible HTML pages in milliseconds.</p>
    <h2>Quick Usage</h2>
    <pre><code>zengarden build --input ./content --output ./dist</code></pre>
    <p>Released under the Apache 2.0 License by the ZenGarden Contributors.</p>
  </main>
</body>
</html>`
  },
  {
    id: "benign-15",
    label: "benign",
    category: "hard-benign-legit-saas-login",
    url: "https://app.acmecrm.example.com/login",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Sign In | AcmeCRM Workspace</title>
</head>
<body>
  <main class="acme-auth">
    <h1>AcmeCRM</h1>
    <h2>Sign in to your AcmeCRM workspace</h2>
    <form action="https://app.acmecrm.example.com/api/session" method="POST">
      <label for="email">Work Email</label>
      <input id="email" name="email" type="email" placeholder="you@acmecrm.example.com" required />
      <label for="password">Password</label>
      <input id="password" name="password" type="password" required />
      <button type="submit">Sign In to AcmeCRM</button>
    </form>
    <p><a href="https://app.acmecrm.example.com/reset-password">Forgot your AcmeCRM password?</a></p>
  </main>
</body>
</html>`
  },
  {
    id: "benign-16",
    label: "benign",
    category: "hard-benign-legit-hr-portal-login",
    url: "https://portal.northstar-hr.example.net/signin",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Northstar HR Portal - Employee Sign In</title>
</head>
<body>
  <main class="northstar-login">
    <h1>Northstar HR &amp; Payroll</h1>
    <p>Sign in with your Northstar HR employee account to view pay stubs and PTO balances.</p>
    <form action="https://portal.northstar-hr.example.net/auth/login" method="POST">
      <label for="emp-email">Employee Email</label>
      <input id="emp-email" name="email" type="email" required />
      <label for="emp-password">Password</label>
      <input id="emp-password" name="password" type="password" required />
      <button type="submit">Sign In</button>
    </form>
  </main>
</body>
</html>`
  },
  {
    id: "benign-17",
    label: "benign",
    category: "hard-benign-phishing-awareness-tutorial",
    url: "https://security-academy.example.org/tutorials/recognizing-phishing",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>How Phishing Works: Spotting Fake PayPal and Microsoft Login Pages</title>
</head>
<body>
  <article>
    <h1>Educational Guide: How to Recognize Phishing Attacks</h1>
    <p>In this cybersecurity tutorial, we examine how attackers craft deceptive emails claiming your PayPal, Chase, or Microsoft 365 account has been suspended.</p>
    <h2>Key Warning Signs</h2>
    <ul>
      <li><strong>Lookalike Domains:</strong> Always inspect the hostname before entering a password—attackers register typosquats like <code>paypa1</code> or <code>rnicrosoft</code>.</li>
      <li><strong>Artificial Urgency:</strong> Claims that your account will be deleted in 24 hours unless you verify your password immediately.</li>
    </ul>
    <p>Note: This page is an educational resource with no login forms or credential inputs.</p>
  </article>
</body>
</html>`
  },
  {
    id: "benign-18",
    label: "benign",
    category: "hard-benign-security-blog-typosquatting",
    url: "https://infosec-notes.vercel.app/articles/defending-against-lookalike-domains",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Defending Against Homograph &amp; Lookalike Domains | InfoSec Notes</title>
</head>
<body>
  <article>
    <h1>Why FIDO2 Passkeys Stop Credential Phishing</h1>
    <p>Traditional password authentication relies on users visually verifying whether a login page belongs to Google, Apple, or Bank of America.</p>
    <p>When organisations deploy WebAuthn / FIDO2 hardware security keys, the browser cryptographically binds the authentication challenge to the origin domain, neutralizing typosquatted phishing proxies.</p>
    <h2>Additional Defense-in-Depth Measures</h2>
    <ul>
      <li>Monitor Certificate Transparency logs for newly issued lookalike certificates.</li>
      <li>Enforce hardware-backed WebAuthn policies across all administrative accounts.</li>
    </ul>
  </article>
</body>
</html>`
  },
  {
    id: "benign-19",
    label: "benign",
    category: "hard-benign-bank-marketing-page",
    url: "https://harborview-credit-union.example.com/savings-plans",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>High-Yield Savings &amp; CD Rates | Harborview Community Credit Union</title>
</head>
<body>
  <header>
    <h1>Harborview Community Credit Union</h1>
    <p>Member-owned cooperative banking serving the Pacific Northwest since 1964.</p>
  </header>
  <main>
    <h2>Compare Our Personal Savings Accounts</h2>
    <p>Earn 4.35% APY on balances over $1,000 with no monthly maintenance fees and NCUA federal deposit insurance up to $250,000.</p>
    <p>Visit any of our 12 local branch locations in Tacoma and Olympia to open an account in person.</p>
  </main>
</body>
</html>`
  },
  {
    id: "benign-20",
    label: "benign",
    category: "hard-benign-oauth-github-devtool",
    url: "https://deploypreview-ci.vercel.app/auth",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Sign In | DeployPreview CI</title>
</head>
<body>
  <main>
    <h1>DeployPreview CI</h1>
    <p>Automated ephemeral staging environments for pull requests. We never ask for your password—authenticate securely via GitHub OAuth.</p>
    <p>
      <a class="oauth-btn" href="https://github.com/login/oauth/authorize?client_id=iv1.synthetic000">
        Log in with GitHub (OAuth 2.0)
      </a>
    </p>
    <p>Read our <a href="/docs/permissions">GitHub App permissions documentation</a> to see why we only request read-only pull request metadata.</p>
  </main>
</body>
</html>`
  },
  {
    id: "benign-21",
    label: "benign",
    category: "hard-benign-password-manager-landing",
    url: "https://ironvault-pass.example.net/",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>IronVault Password Manager - Zero-Knowledge Credential Security</title>
</head>
<body>
  <header>
    <h1>IronVault Password Manager</h1>
    <p>Generate, store, and autofill strong unique passwords and passkeys across all your devices with end-to-end AES-256-GCM encryption.</p>
  </header>
  <section>
    <h2>Audited Open-Source Cryptography</h2>
    <p>Your master password never leaves your device. IronVault derives encryption keys locally using Argon2id before syncing encrypted vault blobs.</p>
    <a href="/downloads">Download the Desktop &amp; Browser Extensions</a>
  </section>
</body>
</html>`
  },
  {
    id: "benign-22",
    label: "benign",
    category: "hard-benign-security-docs-2fa",
    url: "https://help.stackforge.example.org/security/two-factor-authentication",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Configuring Two-Factor Authentication (2FA) | StackForge Help Center</title>
</head>
<body>
  <article>
    <h1>Protecting Your StackForge Account with 2FA and Passkeys</h1>
    <p>Adding a second factor of authentication protects your workspace even if your password is exposed in a third-party breach.</p>
    <h2>Supported Second Factors</h2>
    <ul>
      <li>FIDO2 / WebAuthn Hardware Security Keys (recommended)</li>
      <li>TOTP Authenticator Apps (RFC 6238)</li>
      <li>SAML 2.0 Enterprise Single Sign-On via Okta or Azure AD</li>
    </ul>
  </article>
</body>
</html>`
  },
  // The three samples shipped in pages/demo.tsx
  {
    id: "demo-paypal",
    label: "phishing",
    category: "repo-demo-sample",
    url: "https://paypa1-secure.example.com",
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
    id: "demo-microsoft",
    label: "phishing",
    category: "repo-demo-sample",
    url: "https://micr0soft-login.example.com",
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
    id: "demo-bank",
    label: "benign",
    category: "repo-demo-sample",
    url: "https://examplebank.com",
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
];
