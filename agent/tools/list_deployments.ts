import { defineTool } from "eve/tools";
import { z } from "zod";
import { storage } from "../../lib/storage";
import { getSite } from "../../lib/account/sites";

export default defineTool({
  description:
    "List recently scanned deployments (newest first), optionally filtered by status, so they can be re-scanned with deep_scan.",
  inputSchema: z.object({
    statuses: z.array(z.enum(["pending", "scanning", "clean", "review", "flagged"])).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  async execute({ statuses, limit }) {
    const recent = await storage.getRecentDeployments(200);
    const allowed = await Promise.all(recent.map(async d => {
      if (!d.ownerId || !d.siteId) return null;
      const site = await getSite(d.siteId);
      // Website schedules are handled by /api/sites/monitor, including re-verification.
      return site && site.ownerId === d.ownerId && site.kind === 'vercel' && site.monitoring && site.verifiedAt ? d : null;
    }));
    return allowed.filter((d): d is NonNullable<typeof d> => Boolean(d))
      .filter((d) => !statuses?.length || statuses.includes(d.status))
      .slice(0, limit ?? 20)
      .map((d) => ({ deploymentId: d.id, url: d.url, status: d.status, projectId: d.projectId, siteId: d.siteId }));
  },
});
