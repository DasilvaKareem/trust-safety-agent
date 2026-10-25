import type { NextApiRequest, NextApiResponse } from 'next';
import { getDemoFixture } from '@/lib/demo/fixtures';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = typeof req.query.slug === 'string' ? req.query.slug : '';
  const fixture = getDemoFixture(slug);

  if (!fixture) {
    res.status(404).setHeader('Content-Type', 'text/plain; charset=utf-8').send('Fixture not found');
    return;
  }

  res
    .status(200)
    .setHeader('Content-Type', 'text/html; charset=utf-8')
    .setHeader('X-Robots-Tag', 'noindex')
    .send(fixture.html);
}
