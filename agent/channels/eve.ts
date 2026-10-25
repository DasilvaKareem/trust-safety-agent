import { timingSafeEqual } from "node:crypto";
import { eveChannel } from "eve/channels/eve";
import { extractBearerToken, localDev, vercelOidc, withAuthChallenges, type AuthFn } from "eve/channels/auth";

// The webhook route (pages/api/webhooks/vercel.ts) authenticates to /eve/v1/session with a
// shared server-side token. Browser/anonymous traffic is rejected (fail closed).
const scanToken: AuthFn<Request> = withAuthChallenges((request) => {
  const expected = process.env.EVE_SCAN_TOKEN;
  const given = extractBearerToken(request.headers.get("authorization"));
  if (!expected || !given) return null;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return {
    authenticator: "scan-token",
    principalId: "vercel-webhook",
    principalType: "service",
    attributes: {},
  };
}, [{ scheme: "Bearer" }]);

export default eveChannel({
  auth: [scanToken, vercelOidc(), localDev()],
});
