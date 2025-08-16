import { NextResponse } from 'next/server';

export async function GET() {
  const config = {
    accountAssociation: {
      header:
        'eyJmaWQiOjczODU3NCwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweGU1MDkxZDU0NmI1ODI3NDA1OTMzMjU0QUZiNmU1M2VEOEE0NzEzRjEifQ',
      payload: 'eyJkb21haW4iOiJlbmItY3J1c2hlcnMudmVyY2VsLmFwcCJ9',
      signature:
        'MHhiMWEzNmUzOGJjNzA2MmMwNGYwMWJmYWYwOWIzMTQ2MGIwY2MzMTAxM2IxODllOTE3YTViYmJmY2E4YTFlNTI0NjJiOTc1NjI4OTkwZTUzOTBhNTE2MTEzMjA0ZDMxNTJhMjRmMmY0NGUwYWZjMGUwOTU0MDYyNzEyNzA1NTM2MTFj',
    },
    frame: {
      version: '1',
      name: 'ENB Mining',
      iconUrl: 'https://enb-crushers.vercel.app/icon.png',
      splashImageUrl: 'https://enb-crushers.vercel.app/splash.png',
      splashBackgroundColor: '#A93445',
      homeUrl: 'https://enb-crushers.vercel.app/',
      heroImageUrl:
        'https://enb-crushers.vercel.app/image.png',
      webhookUrl: 'https://enb-crushers.vercel.app/api/webhook',
      subtitle: 'Fast, Simple, Onchain',
      description: 'earn ENB daily on Farcaster',
      primaryCategory: 'finance',
      tags: ['boosters', 'daily claims', 'mining', 'blockchain'],
      tagline: 'Fast, Simple, Onchain',
      ogTitle: 'enb',
      ogDescription: 'earn ENB daily on Farcaster',
      ogImageUrl:
        'https://enb-crushers.vercel.app/og-image.png',
    },
  };

  return NextResponse.json(config);
}

export const runtime = 'edge';
