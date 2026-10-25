import type { NextConfig } from 'next';
import { withEve } from 'eve/next';

const config: NextConfig = {
  reactStrictMode: true,
};

// Mounts the eve agent in ./agent at /eve/v1/* (a separate Vercel service in the same project)
// and turns agent/schedules/* into Vercel Cron Jobs.
export default withEve(config);
