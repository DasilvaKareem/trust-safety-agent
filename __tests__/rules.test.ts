/**
 * Tests for rules-based scoring
 */

import { computeRulesScore, determineStatus } from '../lib/rules';

describe('Rules Scoring', () => {
  describe('computeRulesScore', () => {
    it('notes a bare password form but keeps it clean (logins are normal)', () => {
      const html = `
        <html>
          <body>
            <form>
              <input type="email" name="email">
              <input type="password" name="password">
              <button type="submit">Sign In</button>
            </form>
          </body>
        </html>
      `;
      const result = computeRulesScore(html, 'https://example.com');
      
      expect(result.flags.hasLoginForm).toBe(true);
      expect(result.score).toBeLessThan(0.3);
      expect(result.reasons).toContain('Contains password input form');
    });

    it('should flag brand keywords on non-brand domains', () => {
      const html = `
        <html>
          <body>
            <h1>PayPal Login</h1>
            <p>Enter your PayPal password to access your account</p>
            <form>
              <input type="password">
            </form>
          </body>
        </html>
      `;
      const result = computeRulesScore(html, 'https://fake-site.com');
      
      expect(result.flags.hasBrandKeywords).toBe(true);
      expect(result.score).toBeGreaterThan(0.3);
    });

    it('should NOT flag brand keywords on brand domains', () => {
      const html = `
        <html>
          <body>
            <h1>PayPal Login</h1>
            <p>Enter your password</p>
            <form>
              <input type="password">
            </form>
          </body>
        </html>
      `;
      const result = computeRulesScore(html, 'https://paypal.com');
      
      expect(result.flags.hasBrandKeywords).toBeFalsy();
    });

    it('should detect typosquat domains', () => {
      const result = computeRulesScore('', 'https://paypa1.com');
      
      expect(result.flags.isTyposquat).toBe(true);
      expect(result.score).toBeGreaterThan(0.4);
      expect(result.reasons.some(r => r.includes('Typosquat'))).toBe(true);
    });

    it('should flag CLI deploys without git source', () => {
      const result = computeRulesScore('', 'https://example.com', {
        gitSource: false
      });
      
      expect(result.flags.isCliDeploy).toBe(true);
      expect(result.reasons).toContain('Deployed from CLI without git source');
    });

    it('should flag new accounts', () => {
      const result = computeRulesScore('', 'https://example.com', {
        accountAge: 3
      });
      
      expect(result.flags.isNewAccount).toBe(true);
      expect(result.reasons).toContain('New account or project (< 7 days)');
    });

    it('should return relatively clean score for legitimate page without suspicious patterns', () => {
      const html = `
        <html>
          <body>
            <h1>ABC Business Solutions</h1>
            <p>Welcome to our website.</p>
            <p>Contact: info@abcbiz.com</p>
          </body>
        </html>
      `;
      const result = computeRulesScore(html, 'https://abcbiz.com', {
        gitSource: true,
        accountAge: 365
      });
      
      // Should not have high-risk flags
      expect(result.flags.hasLoginForm).toBeFalsy();
      expect(result.flags.isCliDeploy).toBeFalsy();
      expect(result.flags.isNewAccount).toBeFalsy();
    });

    it('ignores brand names on pages that collect nothing (tutorials, blogs)', () => {
      const html = `<h1>How to spot fake PayPal and Microsoft login pages</h1>
        <p>Attackers claim your account has been suspended and ask you to verify your identity now.</p>`;
      const r = computeRulesScore(html, 'https://security-blog.example.org/phishing');
      expect(r.score).toBe(0);
      expect(r.flags.hasBrandKeywords).toBeFalsy();
    });

    it('does not treat "Sign in with Google" SSO as impersonation', () => {
      const html = `<h1>Acme</h1><form action="/session"><input type="password"></form>
        <a href="https://accounts.google.com/o/oauth2">Sign in with Google</a>`;
      const r = computeRulesScore(html, 'https://app.acme.example.com/login');
      expect(r.flags.hasBrandKeywords).toBeFalsy();
      expect(r.score).toBeLessThan(0.3);
    });

    it('flags card / seed-phrase collection with urgency and a brand', () => {
      const html = `<title>USPS Delivery</title><p>Unpaid fee: your parcel is held.</p>
        <form action="/pay"><input name="cc"><input name="cvc"></form>`;
      const r = computeRulesScore(html, 'https://parcel-help.example.com');
      expect(r.flags.hasSensitiveFields).toBe(true);
      expect(r.flags.hasBrandKeywords).toBe(true);
      expect(r.flags.hasUrgencyLanguage).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0.6);
    });

    it('flags a password form that posts to a different site', () => {
      const html = `<form action="https://collector.evil.example.net/p"><input type="password"></form>`;
      const r = computeRulesScore(html, 'https://login-portal.example.com');
      expect(r.flags.hasExternalFormAction).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(0.3);
    });

    it('should cap score at 1.0', () => {
      const html = `
        <html>
          <body>
            <h1>PayPal Login Verify Password Account Security</h1>
            <form>
              <input type="password">
            </form>
          </body>
        </html>
      `;
      const result = computeRulesScore(html, 'https://paypa1-security.com', {
        gitSource: false,
        accountAge: 1
      });
      
      expect(result.score).toBeLessThanOrEqual(1.0);
    });
  });

  describe('typosquat detection', () => {
    it('does not flag ordinary domains', () => {
      const r = computeRulesScore('<html><body>Docs</body></html>', 'https://docs.nebula-db.example.com/getting-started');
      expect(r.flags.isTyposquat).toBeUndefined();
      expect(r.score).toBe(0);
    });

    it('flags rn-for-m lookalikes', () => {
      const r = computeRulesScore('<html></html>', 'https://rnicrosoft-login.vercel.app');
      expect(r.flags.isTyposquat).toBe(true);
    });
  });

  describe('determineStatus', () => {
    it('should return clean for low scores', () => {
      expect(determineStatus(0.1)).toBe('clean');
      expect(determineStatus(0.29)).toBe('clean');
    });

    it('should return review for medium scores', () => {
      expect(determineStatus(0.3)).toBe('review');
      expect(determineStatus(0.5)).toBe('review');
      expect(determineStatus(0.59)).toBe('review');
    });

    it('should return flagged for high scores', () => {
      expect(determineStatus(0.6)).toBe('flagged');
      expect(determineStatus(0.9)).toBe('flagged');
      expect(determineStatus(1.0)).toBe('flagged');
    });

    it('should use max of rules and gemini scores', () => {
      expect(determineStatus(0.2, 0.8)).toBe('flagged');
      expect(determineStatus(0.8, 0.2)).toBe('flagged');
    });
  });
});
