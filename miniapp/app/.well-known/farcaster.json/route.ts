import { NextResponse } from 'next/server';

export async function GET() {
  const config = {
    accountAssociation: {
      header:
        'eyJmaWQiOjczODU3NCwidHlwZSI6ImF1dGgiLCJrZXkiOiIweGRiMjk3OWZkRjY4OTU3MUREMTYyN0E2MzNkNjk3MTZEMzlkOTE5RGMifQ',
      payload: 'eyJkb21haW4iOiJlbmItY3J1c2hlcnMudmVyY2VsLmFwcCJ9',
      signature:
        'NQq8k6SnEubOPyxJH6Egm8qtWG52hhD3PUKHpGv3cI96jc7dQD7V6OisWuFfsQgNmxnq4cEjNoMdlgoGMpZDtxs=',
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
