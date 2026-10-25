/**
 * Storage interface for the Trust & Safety agent
 * Supports Upstash Redis (via @vercel/kv) with in-memory fallback for local dev
 */

export interface Installation {
  id: string;
  teamId: string;
  userId: string;
  accessToken: string;
  configurationId: string;
  webhookId?: string;
  createdAt: number;
}

export interface Deployment {
  id: string;
  installationId: string;
  projectId: string;
  url: string;
  deploymentUrl: string;
  createdAt: number;
  rulesScore: number;
  rulesReasons: string[];
  geminiScore?: number;
  geminiReasons?: string[];
  geminiImpersonatedBrand?: string;
  status: 'pending' | 'scanning' | 'clean' | 'review' | 'flagged';
  contentHash?: string;
  simHash?: string;
  clusterId?: string;
  reviewedAt?: number;
  reviewedBy?: string;
  reviewDecision?: 'approved' | 'dismissed' | 'blocked';
}

export interface Cluster {
  id: string;
  simHash: string;
  deploymentIds: string[];
  firstSeen: number;
  lastSeen: number;
  count: number;
}

let kvStore: typeof import('@vercel/kv').kv | null = null;
const memoryStore: Record<string, any> = {};

async function initKV() {
  if (kvStore) return;
  
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      kvStore = kv;
      console.log('[Storage] Using Upstash Redis');
    } else {
      console.log('[Storage] No KV credentials found, using in-memory storage');
    }
  } catch (error) {
    console.warn('[Storage] Failed to initialize KV, using in-memory storage:', error);
  }
}

export const storage = {
  async saveInstallation(installation: Installation): Promise<void> {
    await initKV();
    if (kvStore) {
      await kvStore.set(`installation:${installation.id}`, installation);
      await kvStore.sadd('installations', installation.id);
    } else {
      memoryStore[`installation:${installation.id}`] = installation;
      if (!memoryStore['installations']) memoryStore['installations'] = new Set();
      (memoryStore['installations'] as Set<string>).add(installation.id);
    }
  },

  async getInstallation(id: string): Promise<Installation | null> {
    await initKV();
    if (kvStore) {
      return await kvStore.get(`installation:${id}`);
    } else {
      return memoryStore[`installation:${id}`] || null;
    }
  },

  async getAllInstallations(): Promise<Installation[]> {
    await initKV();
    if (kvStore) {
      const ids = await kvStore.smembers('installations');
      const installations = await Promise.all(
        ids.map(id => kvStore!.get(`installation:${id}`))
      );
      return installations.filter(Boolean) as Installation[];
    } else {
      const installationSet = memoryStore['installations'] as Set<string> | undefined;
      if (!installationSet) return [];
      return Array.from(installationSet)
        .map(id => memoryStore[`installation:${id}`])
        .filter(Boolean);
    }
  },

  async saveDeployment(deployment: Deployment): Promise<void> {
    await initKV();
    if (kvStore) {
      await kvStore.set(`deployment:${deployment.id}`, deployment);
      await kvStore.zadd('deployments', { score: deployment.createdAt, member: deployment.id });
      
      if (deployment.status === 'review') {
        await kvStore.sadd('review-queue', deployment.id);
      }
    } else {
      memoryStore[`deployment:${deployment.id}`] = deployment;
      if (!memoryStore['deployments']) memoryStore['deployments'] = [];
      (memoryStore['deployments'] as Deployment[]).push(deployment);
      
      if (deployment.status === 'review') {
        if (!memoryStore['review-queue']) memoryStore['review-queue'] = new Set();
        (memoryStore['review-queue'] as Set<string>).add(deployment.id);
      }
    }
  },

  async getDeployment(id: string): Promise<Deployment | null> {
    await initKV();
    if (kvStore) {
      return await kvStore.get(`deployment:${id}`);
    } else {
      return memoryStore[`deployment:${id}`] || null;
    }
  },

  async getRecentDeployments(limit: number = 50): Promise<Deployment[]> {
    await initKV();
    if (kvStore) {
      const ids = await kvStore.zrange('deployments', 0, limit - 1, { rev: true });
      const deployments = await Promise.all(
        ids.map(id => kvStore!.get(`deployment:${id}`))
      );
      return deployments.filter(Boolean) as Deployment[];
    } else {
      const deployments = memoryStore['deployments'] as Deployment[] || [];
      return deployments
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit);
    }
  },

  async getReviewQueue(): Promise<Deployment[]> {
    await initKV();
    if (kvStore) {
      const ids = await kvStore.smembers('review-queue');
      const deployments = await Promise.all(
        ids.map(id => kvStore!.get(`deployment:${id}`))
      );
      return deployments.filter(Boolean) as Deployment[];
    } else {
      const queueSet = memoryStore['review-queue'] as Set<string> | undefined;
      if (!queueSet) return [];
      return Array.from(queueSet)
        .map(id => memoryStore[`deployment:${id}`])
        .filter(Boolean);
    }
  },

  async updateDeploymentStatus(id: string, status: Deployment['status'], reviewData?: { reviewedBy: string; reviewDecision: 'approved' | 'dismissed' | 'blocked' }): Promise<void> {
    await initKV();
    const deployment = await this.getDeployment(id);
    if (!deployment) return;

    deployment.status = status;
    if (reviewData) {
      deployment.reviewedAt = Date.now();
      deployment.reviewedBy = reviewData.reviewedBy;
      deployment.reviewDecision = reviewData.reviewDecision;
    }

    if (kvStore) {
      await kvStore.set(`deployment:${id}`, deployment);
      if (status !== 'review') {
        await kvStore.srem('review-queue', id);
      }
    } else {
      memoryStore[`deployment:${id}`] = deployment;
      if (status !== 'review') {
        const queueSet = memoryStore['review-queue'] as Set<string> | undefined;
        queueSet?.delete(id);
      }
    }
  },

  async saveCluster(cluster: Cluster): Promise<void> {
    await initKV();
    if (kvStore) {
      await kvStore.set(`cluster:${cluster.id}`, cluster);
      await kvStore.set(`simhash:${cluster.simHash}`, cluster.id);
    } else {
      memoryStore[`cluster:${cluster.id}`] = cluster;
      memoryStore[`simhash:${cluster.simHash}`] = cluster.id;
    }
  },

  async getClusterBySimHash(simHash: string): Promise<Cluster | null> {
    await initKV();
    if (kvStore) {
      const clusterId = await kvStore.get<string>(`simhash:${simHash}`);
      if (!clusterId) return null;
      return await kvStore.get(`cluster:${clusterId}`);
    } else {
      const clusterId = memoryStore[`simhash:${simHash}`];
      if (!clusterId) return null;
      return memoryStore[`cluster:${clusterId}`] || null;
    }
  },

  async getAllClusters(): Promise<Cluster[]> {
    await initKV();
    if (kvStore) {
      const keys = [];
      for await (const key of kvStore.scanIterator({ match: 'cluster:*' })) {
        keys.push(key);
      }
      const clusters = await Promise.all(
        keys.map(key => kvStore!.get(key))
      );
      return clusters.filter(Boolean) as Cluster[];
    } else {
      return Object.keys(memoryStore)
        .filter(key => key.startsWith('cluster:'))
        .map(key => memoryStore[key])
        .filter(Boolean);
    }
  },
};
