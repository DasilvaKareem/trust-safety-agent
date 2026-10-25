# Contributing

Use Node.js 24 and `npm ci`. Start with the [README](README.md) and [deployment guide](DEPLOYMENT.md). `AGENTS.md` points coding agents to the installed Next.js documentation.

1. Create a branch from the latest `main`.
2. Keep changes scoped, and preserve account ownership checks, request-origin validation, webhook signatures, and safe URL fetching.
3. Add meaningful tests for changed behavior. Use synthetic fixtures; do not put real credentials, private data, or live phishing payload captures in tests.
4. Run `npm test -- --runInBand` and `npm run build`. A build applies migrations when database variables are present, so use a development database.
5. Update relevant documentation for environment variables, routes, or user-visible behavior.
6. Open a pull request describing the problem, resulting behavior, validation, and any remaining limitations.

GitHub CI runs without application secrets and must not need a real Google, Neon, or Vercel account. Live provider checks are separate from mocked tests. Do not print tokens in logs or commit `.env*` files other than the blank `.env.example` template.

For benchmark changes, preserve dataset provenance, sampling details, raw results, model configuration, and caveats. Synthetic metrics are not general accuracy claims. API-backed evaluations can cost money; use the estimator first.
