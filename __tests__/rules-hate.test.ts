/**
 * Tests for hate speech and violent extremism signals in rules-based scoring
 */

import { computeRulesScore } from '../lib/rules';
import { getDemoFixture } from '../lib/demo/fixtures';

describe('Rules - Hate & Extremism Signals', () => {
  it('flags the hate-group fixture with hasHateSignals and score >= 0.3', () => {
    const fixture = getDemoFixture('hate-group')!;
    expect(fixture).toBeDefined();

    const result = computeRulesScore(fixture.html, fixture.url);
    expect(result.flags.hasHateSignals).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.3);
    expect(result.categoryHint).toBe('hate_harassment');
  });

  it('keeps legit-bank and fake-paypal scores unchanged from baseline', () => {
    const legitBank = getDemoFixture('legit-bank')!;
    const fakePaypal = getDemoFixture('fake-paypal')!;

    const legitResult = computeRulesScore(legitBank.html, legitBank.url);
    expect(legitResult.score).toBe(0);
    expect(legitResult.flags.hasHateSignals).toBeUndefined();
    expect(legitResult.flags.hasExtremismSignals).toBeUndefined();

    const paypalResult = computeRulesScore(fakePaypal.html, fakePaypal.url);
    // Password form (0.15) + brand impersonation (0.35) + urgency (0.15) + typosquat (0.50) = capped at 1.0
    expect(paypalResult.score).toBe(1);
    expect(paypalResult.flags.hasLoginForm).toBe(true);
    expect(paypalResult.flags.hasBrandKeywords).toBe(true);
    expect(paypalResult.flags.isTyposquat).toBe(true);
    expect(paypalResult.flags.hasHateSignals).toBeUndefined();
  });

  it('keeps a news article about a hate crime trial with no dehumanizing statements below 0.3', () => {
    const newsHtml = `<!DOCTYPE html>
<html>
<head><title>Federal Court Opens Trial in Synagogue Vandalism Case</title></head>
<body>
  <article>
    <h1>Federal Court Opens Trial in Hate Crime Case</h1>
    <p>By Civic Desk • October 2026</p>
    <p>
      Prosecutors presented opening statements Monday in the trial of a man accused of vandalizing
      a community center and harassing local Jewish and Muslim residents last winter.
    </p>
    <p>
      Civil rights advocates and community leaders gathered outside the courthouse to condemn antisemitism
      and Islamophobia and call for stronger hate-crime reporting across the state.
    </p>
  </article>
</body>
</html>`;
    const result = computeRulesScore(newsHtml, 'https://metro-herald.example.com/news/court-trial');
    expect(result.score).toBeLessThan(0.3);
    expect(result.flags.hasHateSignals).toBeUndefined();
    expect(result.flags.hasExtremismSignals).toBeUndefined();
  });

  it('flags violent extremist recruitment phrases with hasExtremismSignals and score >= 0.3', () => {
    const extremistHtml = `<!DOCTYPE html>
<html>
<head><title>Iron Front Cell</title></head>
<body>
  <h1>Prepare for the Coming Race War</h1>
  <p>Join our militia today and take up arms to fight for the homeland.</p>
</body>
</html>`;
    const result = computeRulesScore(extremistHtml, 'https://iron-cell.example.org');
    expect(result.flags.hasExtremismSignals).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.3);
    expect(result.categoryHint).toBe('violent_extremism');
  });

  it('does not flag negated debunking statements in anti-hate education', () => {
    const education = getDemoFixture('anti-hate-education')!;
    const result = computeRulesScore(education.html, education.url);
    expect(result.score).toBeLessThan(0.3);
    expect(result.flags.hasHateSignals).toBeUndefined();
  });
});
