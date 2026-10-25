import type { NextConfig } from 'next';
import { withEve } from 'eve/next';

const config: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/fixtures/:slug',
        destination: '/api/fixtures/:slug',
      },
    ];
  },
};

// Mounts the eve agent in ./agent at /eve/v1/* (a separate Vercel service in the same project)
// No schedules are defined (no cron); see examples/scheduled-rescan.md.
export default withEve(config);
