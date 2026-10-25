/**
 * Fast rules-based scoring for phishing and abuse detection
 * Runs synchronously on every deployment
 */

export interface RulesResult {
  score: number; // 0-1
  reasons: string[];
  flags: {
    hasLoginForm?: boolean;
    hasSensitiveFields?: boolean;
    hasExternalFormAction?: boolean;
    hasBrandKeywords?: boolean; // third-party brand impersonation next to data collection
    hasUrgencyLanguage?: boolean;
    isTyposquat?: boolean;
    isCliDeploy?: boolean;
    isNewAccount?: boolean;
  };
}

/**
 * Scoring model (v2). A login form by itself is normal (every SaaS app has one), and
 * brand names by themselves are normal (security blogs, tutorials, docs). Phishing is the
 * *combination* of collecting secrets with impersonating someone else, pressuring the user,
 * or sending the data off-site. So context signals only count when the page collects data:
 *   password form                       0.15  (alone: stays clean)
 *   card / SSN / seed-phrase fields     0.30
 *   collection + third-party brand      0.35
 *   collection + off-site form action   0.30
 *   collection + urgency language       0.15
 *   typosquat hostname                  0.50  (independent of content)
 *   CLI deploy 0.15, new account 0.10   (metadata)
 */

/** Third-party brands commonly impersonated, with the registrable domains they own. */
const IMPERSONATED_BRANDS: Array<{ name: RegExp; domains: string[] }> = [
  { name: /\bpaypal\b/i, domains: ['paypal.com'] },
  { name: /\bstripe\b/i, domains: ['stripe.com'] },
  { name: /\b(microsoft|office ?365|outlook|onedrive|azure)\b/i, domains: ['microsoft.com', 'live.com', 'office.com', 'outlook.com'] },
  { name: /\b(google|gmail)\b/i, domains: ['google.com', 'gmail.com'] },
  { name: /\b(Apple ID|Apple Account|APPLE ID|iCloud)\b/, domains: ['apple.com', 'icloud.com'] },
  { name: /\bamazon\b/i, domains: ['amazon.com', 'aws.amazon.com'] },
  { name: /\b(facebook|instagram|whatsapp)\b/i, domains: ['facebook.com', 'meta.com', 'instagram.com', 'whatsapp.com'] },
  { name: /\b(twitter)\b/i, domains: ['twitter.com', 'x.com'] },
  { name: /\blinkedin\b/i, domains: ['linkedin.com'] },
  { name: /\bnetflix\b/i, domains: ['netflix.com'] },
  { name: /\b(Chase|CHASE|Wells ?Fargo|Bank of America|Citibank|HSBC|Barclays)\b/, domains: ['chase.com', 'wellsfargo.com', 'bankofamerica.com', 'citi.com', 'hsbc.com', 'barclays.co.uk'] },
  { name: /\b(MetaMask|Metamask|Coinbase|Binance|Ledger Live|Trust ?Wallet|Phantom Wallet)\b/, domains: ['metamask.io', 'coinbase.com', 'binance.com', 'ledger.com', 'trustwallet.com', 'phantom.app'] },
  { name: /\b(USPS|DHL|FedEx|UPS)\b/, domains: ['usps.com', 'dhl.com', 'fedex.com', 'ups.com'] },
  { name: /\b(dropbox|docusign|adobe)\b/i, domains: ['dropbox.com', 'docusign.com', 'docusign.net', 'adobe.com'] },
  { name: /\b(github|vercel)\b/i, domains: ['github.com', 'vercel.com'] },
  { name: /\b(Steam|Roblox|Discord)\b/, domains: ['steampowered.com', 'steamcommunity.com', 'roblox.com', 'discord.com'] },
];

const SENSITIVE_FIELD = /<(input|textarea|select)\b[^>]*\b(name|id|autocomplete|placeholder)\s*=\s*["'][^"']*(card.?num|cc-?number|\bcc\b|cvv|cvc|csc|expiry|cc-exp|ssn|social.?security|tax.?id|seed|mnemonic|recovery.?phrase|secret.?phrase|private.?key|routing|account.?number|\bpin\b|otp|one.?time)[^"']*["']/i;
const SENSITIVE_LABEL = /(credit|debit) card number|card number|\bcvv\b|\bcvc\b|social security|recovery phrase|seed phrase|private key|12 or 24.word/i;
const URGENCY = /(account (has been|is|will be) (suspended|limited|locked|disabled|closed|deleted)|unusual (sign.?in )?activity|verify your (identity|account) (now|immediately|within)|within (24|48) hours|avoid (suspension|account (closure|deletion))|asset freeze|unpaid (fee|balance|invoice)|final (notice|warning)|immediate action required|re-?validate)/i;

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
}

/** password input inside a form */
function hasLoginForm(html: string): boolean {
  return /<form\b/i.test(html) && /<input[^>]*type\s*=\s*["']password["'][^>]*>/i.test(html);
}

function hasSensitiveFields(html: string): boolean {
  return /<form\b/i.test(html) && (SENSITIVE_FIELD.test(html) || (SENSITIVE_LABEL.test(stripTags(html)) && /<(input|textarea)\b/i.test(html)));
}

/** last two labels of a hostname (good enough without a public-suffix list) */
function baseDomain(host: string): string {
  const parts = host.toLowerCase().replace(/\.$/, '').split('.');
  return parts.slice(-2).join('.');
}

function hostOwns(host: string, domain: string): boolean {
  const h = host.toLowerCase();
  return h === domain || h.endsWith(`.${domain}`);
}

/** absolute form action pointing at a different site than the page */
function externalFormAction(html: string, pageHost: string): string | undefined {
  for (const m of html.matchAll(/<form\b[^>]*\baction\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const target = new URL(m[1]);
      if (/^https?:$/.test(target.protocol) && baseDomain(target.hostname) !== baseDomain(pageHost)) return target.hostname;
    } catch { /* relative action: same site */ }
  }
  return undefined;
}

/** a third-party brand named prominently on a host that brand does not own */
function impersonatedBrand(html: string, host: string): string | undefined {
  // "Sign in with Google" / "Continue with GitHub" SSO buttons are not impersonation.
  // Impersonation puts the brand where the user looks for identity: title, headings, logo
  // alt text, buttons and labels. A passing mention in body copy ("we accept PayPal") is not.
  const prominent = [
    ...html.matchAll(/<(title|h1|h2|h3|button|label|legend)\b[^>]*>([\s\S]*?)<\/\1>/gi),
  ].map(m => m[2]).join(' ') + ' ' + [...html.matchAll(/\balt\s*=\s*["']([^"']*)["']/gi)].map(m => m[1]).join(' ');
  const text = stripTags(prominent).replace(/\b(sign|log)\s?(in|up)\s+(with|via|using)\s+\S+|\bcontinue\s+with\s+\S+/gi, ' ');
  for (const brand of IMPERSONATED_BRANDS) {
    if (brand.domains.some(d => hostOwns(host, d))) continue;
    const m = text.match(brand.name);
    if (m) return m[0];
  }
  return undefined;
}

/**
 * Check for typosquatting/lookalike domains
 */
function isTyposquatDomain(domain: string): boolean {
  const lowerDomain = domain.toLowerCase();
  
  // Common typosquat patterns
  // Note: domain is lowercased, so homoglyph capital-I variants (googIe) appear as "googie".
  // (Previously this list contained /paypa|/, whose empty alternation matched every domain.)
  const patterns = [
    /paypa1/, /paypa1l/, /paypai/,
    /g00gle/, /googie/, /g0ogle/,
    /micr0soft/, /microsfot/, /rnicr0soft/, /rnicrosoft/,
    /app1e/, /appl3/, /appie/,
    /amaz0n/, /arnazon/,
    /faceb00k/, /facebok/, /facebo0k/,
  ];
  
  return patterns.some(pattern => pattern.test(lowerDomain));
}

/**
 * Analyze deployment metadata for risk signals
 */
function analyzeDeploymentMetadata(metadata: {
  gitSource?: boolean;
  accountAge?: number; // days
  projectAge?: number; // days
}): { isCliDeploy: boolean; isNewAccount: boolean } {
  return {
    isCliDeploy: metadata.gitSource === false,
    isNewAccount: (metadata.accountAge !== undefined && metadata.accountAge < 7) ||
                  (metadata.projectAge !== undefined && metadata.projectAge < 1)
  };
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

/**
 * Run all rules and compute a risk score
 */
export function computeRulesScore(
  html: string,
  url: string,
  metadata: {
    gitSource?: boolean;
    accountAge?: number;
    projectAge?: number;
  } = {}
): RulesResult {
  const domain = extractDomain(url);
  const flags: RulesResult['flags'] = {};
  const reasons: string[] = [];
  let score = 0;

  const loginForm = hasLoginForm(html);
  const sensitive = hasSensitiveFields(html);
  const collects = loginForm || sensitive;

  if (loginForm) {
    flags.hasLoginForm = true;
    reasons.push('Contains password input form');
    score += 0.15;
  }
  if (sensitive) {
    flags.hasSensitiveFields = true;
    reasons.push('Collects payment, identity or wallet-recovery data');
    score += 0.3;
  }
  if (collects) {
    const brand = impersonatedBrand(html, domain);
    if (brand) {
      flags.hasBrandKeywords = true;
      reasons.push(`Collects credentials while presenting as ${brand} on a non-${brand} domain`);
      score += 0.35;
    }
    const offsite = externalFormAction(html, domain);
    if (offsite) {
      flags.hasExternalFormAction = true;
      reasons.push(`Form submits to a different site: ${offsite}`);
      score += 0.3;
    }
    if (URGENCY.test(stripTags(html))) {
      flags.hasUrgencyLanguage = true;
      reasons.push('Urgency or account-threat language next to a data-collection form');
      score += 0.15;
    }
  }

  // Check for typosquat domain (very high risk)
  if (isTyposquatDomain(domain)) {
    flags.isTyposquat = true;
    reasons.push(`Typosquat domain detected: ${domain}`);
    score += 0.5;
  }

  // Check deployment metadata
  const metadataFlags = analyzeDeploymentMetadata(metadata);
  
  if (metadataFlags.isCliDeploy) {
    flags.isCliDeploy = true;
    reasons.push('Deployed from CLI without git source');
    score += 0.15;
  }

  if (metadataFlags.isNewAccount) {
    flags.isNewAccount = true;
    reasons.push('New account or project (< 7 days)');
    score += 0.1;
  }

  // Cap score at 1.0
  score = Math.round(Math.min(score, 1.0) * 100) / 100;

  return {
    score,
    reasons,
    flags
  };
}

/**
 * Determine deployment status based on rules score
 */
export function determineStatus(rulesScore: number, geminiScore?: number): 'clean' | 'review' | 'flagged' {
  const effectiveScore = geminiScore !== undefined ? Math.max(rulesScore, geminiScore) : rulesScore;
  
  if (effectiveScore < 0.3) {
    return 'clean';
  } else if (effectiveScore < 0.6) {
    return 'review';
  } else {
    return 'flagged';
  }
}
