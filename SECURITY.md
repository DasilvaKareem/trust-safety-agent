# Security reporting

Report suspected vulnerabilities privately to **kareem@edesia.catering**. Include the affected route, minimal reproduction, expected/actual behavior, and impact. Do not post access tokens, personal data, or exploit details in a public GitHub issue.

This is a hackathon prototype, with no promised security-response SLA. The maintained code is on `main`; there are no supported historical release branches.

## Contributor checklist

- Keep `.env.local`, database URLs, auth cookies, integration tokens, and `.vercel/` files out of Git.
- Use development databases for migration and test work.
- Preserve session/owner checks, same-origin mutation guards, one-time OAuth state, encrypted token storage, and raw-body webhook verification.
- Keep public-page fetches bounded and reject private/loopback addresses and unsafe redirects.
- Treat fetched pages and model output as untrusted data.
- Use `npm audit --omit=dev` to review runtime dependencies; a clean audit is not a complete security assessment.

If a secret is exposed, revoke or rotate it at its provider and update the application environment. Removing it from the latest commit alone does not remove it from Git history. Rotating `AUTH_SECRET` makes existing encrypted integration tokens unreadable; affected connections must be re-established.
