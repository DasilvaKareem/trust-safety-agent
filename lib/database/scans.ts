import { database, postgresRecords } from './index';
import type { Installation, Deployment, Cluster } from '@/lib/storage';
export const postgresScans = {
  async saveInstallation(value: Installation) {
    await postgresRecords.set(`installation:${value.id}`, value);
    await postgresRecords.add('installations', value.id);
  },
  getInstallation(id: string) { return postgresRecords.get<Installation>(`installation:${id}`); },
  async getAllInstallations(): Promise<Installation[]> {
    const rows = await database()`SELECT value FROM argon_guard.records WHERE key LIKE 'installation:%'`;
    return rows.map(row => row.value as Installation);
  },
  async saveDeployment(value: Deployment) {
    await database()`INSERT INTO argon_guard.deployments (id, owner_id, created_at, status, data) VALUES (${value.id}, ${value.ownerId || null}, ${value.createdAt}, ${value.status}, ${JSON.stringify(value)}::jsonb) ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id, created_at = EXCLUDED.created_at, status = EXCLUDED.status, data = EXCLUDED.data`;
  },
  async getDeployment(id: string): Promise<Deployment | null> {
    const rows = await database()`SELECT data FROM argon_guard.deployments WHERE id = ${id}`;
    return rows[0]?.data as Deployment ?? null;
  },
  async getOwnerDeployments(ownerId: string, limit = 100): Promise<Deployment[]> {
    const rows = await database()`SELECT data FROM argon_guard.deployments WHERE owner_id = ${ownerId} ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map(row => row.data as Deployment);
  },
  async getRecentDeployments(limit = 50): Promise<Deployment[]> {
    const rows = await database()`SELECT data FROM argon_guard.deployments ORDER BY created_at DESC LIMIT ${limit}`;
    return rows.map(row => row.data as Deployment);
  },
  async getReviewQueue(): Promise<Deployment[]> {
    const rows = await database()`SELECT data FROM argon_guard.deployments WHERE status = 'review' ORDER BY created_at DESC`;
    return rows.map(row => row.data as Deployment);
  },
  async updateDeploymentStatus(id: string, status: Deployment['status'], reviewData?: { reviewedBy: string; reviewDecision: 'approved' | 'dismissed' | 'blocked' }) {
    const patch = { status, ...(reviewData ? { ...reviewData, reviewedAt: Date.now() } : {}) };
    await database()`UPDATE argon_guard.deployments SET status = ${status}, data = data || ${JSON.stringify(patch)}::jsonb WHERE id = ${id}`;
  },
  async saveCluster(value: Cluster) {
    await postgresRecords.set(`cluster:${value.id}`, value);
    await postgresRecords.set(`simhash:${value.simHash}`, value.id);
  },
  async getClusterBySimHash(simHash: string): Promise<Cluster | null> {
    const id = await postgresRecords.get<string>(`simhash:${simHash}`);
    return id ? postgresRecords.get<Cluster>(`cluster:${id}`) : null;
  },
  async getAllClusters(): Promise<Cluster[]> {
    const rows = await database()`SELECT value FROM argon_guard.records WHERE key LIKE 'cluster:%'`;
    return rows.map(row => row.value as Cluster);
  },
};
