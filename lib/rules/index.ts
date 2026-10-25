/**
 * Fast rules-based scoring for phishing and abuse detection
 * Runs synchronously on every deployment
 */

export interface RulesResult {
  score: number; // 0-1
  reasons: string[];
  flags: {
    hasLoginForm?: boolean;
    hasBrandKeywords?: boolean;
    isTyposquat?: boolean;
    isCliDeploy?: boolean;
    isNewAccount?: boolean;
  };
}

const BRAND_KEYWORDS = [
  'login', 'signin', 'sign-in', 'password', 'authenticate', 'verify',
  'paypal', 'stripe', 'square', 'bank', 'chase', 'wellsfargo', 'bofa',
  'microsoft', 'office365', 'outlook', 'google', 'gmail', 'apple', 'icloud',
  'amazon', 'aws', 'facebook', 'meta', 'twitter', 'x.com', 'linkedin',
  'account', 'security', 'update', 'suspended', 'confirm', 'verification'
];

const KNOWN_BRANDS = [
  'paypal.com', 'stripe.com', 'microsoft.com', 'google.com', 'apple.com',
  'amazon.com', 'facebook.com', 'meta.com', 'twitter.com', 'x.com',
  'chase.com', 'wellsfargo.com', 'bankofamerica.com'
];

/**
 * Check for login/password forms in HTML
 */
function hasLoginForm(html: string): boolean {
  const lowerHtml = html.toLowerCase();
  const hasPasswordInput = /<input[^>]*type\s*=\s*["']password["'][^>]*>/i.test(html);
  const hasLoginKeywords = /\b(login|signin|sign[\s-]in|log[\s-]in)\b/i.test(html);
  const hasForm = /<form/i.test(html);
  
  return hasPasswordInput && hasForm && hasLoginKeywords;
}

/**
 * Check for brand keywords on non-brand domains
 */
function hasBrandKeywordsOnNonBrandDomain(html: string, domain: string): boolean {
  const lowerHtml = html.toLowerCase();
  const lowerDomain = domain.toLowerCase();
  
  // Check if domain is a known brand
  const isKnownBrand = KNOWN_BRANDS.some(brand => lowerDomain.includes(brand));
  if (isKnownBrand) return false;
  
  // Count brand keyword mentions
  const keywordCount = BRAND_KEYWORDS.reduce((count, keyword) => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    const matches = html.match(regex);
    return count + (matches?.length || 0);
  }, 0);
  
  return keywordCount >= 3; // Flag if 3+ brand keywords present
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

  // Check for login form (high risk)
  if (hasLoginForm(html)) {
    flags.hasLoginForm = true;
    reasons.push('Contains password input form');
    score += 0.4;
  }

  // Check for brand keywords on non-brand domain (high risk)
  if (hasBrandKeywordsOnNonBrandDomain(html, domain)) {
    flags.hasBrandKeywords = true;
    reasons.push('Multiple brand keywords on non-brand domain');
    score += 0.35;
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
  score = Math.min(score, 1.0);

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
