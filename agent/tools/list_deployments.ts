import { defineTool } from "eve/tools";
import { z } from "zod";
import { storage } from "../../lib/storage";

export default defineTool({
  description:
    "List recently scanned deployments (newest first), optionally filtered by status, so they can be re-scanned with deep_scan.",
  inputSchema: z.object({
    statuses: z.array(z.enum(["pending", "scanning", "clean", "review", "flagged"])).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  }),
  async execute({ statuses, limit }) {
    const recent = await storage.getRecentDeployments(200);
    return recent
      .filter((d) => !statuses?.length || statuses.includes(d.status))
      .slice(0, limit ?? 20)
      .map((d) => ({ deploymentId: d.id, url: d.url, status: d.status, projectId: d.projectId }));
  },
});
