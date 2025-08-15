import { NextResponse } from 'next/server';

export async function GET() {
  const config = {
    accountAssociation: {
      header:
        'eyJmaWQiOjczODU3NCwidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweDZkNjQ4NDVhOUExYTEwN0Y5OTk3RTQ3N2FjMTk5NTI2ZEViZTlDZTMifQ',
      payload: 'eyJkb21haW4iOiJlbmItY3J1c2hlcnMudmVyY2VsLmFwcCJ9',
      signature:
        'MHg0YzZlNWMxYTVjOGExNjgzY2VjODY0Y2Y3MDQ2NGYxZDczZjdjNGExMjMzOWUyOTQxMTRlOTQ4M2NlMDgwZGJlNGJjNzY3ZGM4YWZlZTVlOThmZWYwMWViYmQ2MTJkYTdlMjZlMTQ4MzA1M2JlY2Y3ZDdmYWEyNDU4NDBlNzJhMDFj',
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
      primaryCategory: 'productivity',
      tags: ['bounties', 'tasks', 'incentives', 'blockchain'],
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
