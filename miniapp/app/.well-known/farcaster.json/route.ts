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
      imageUrl: 'https://enb-crushers.vercel.app/image.png',
      buttonTitle: 'Start Mining',
      heroImageUrl:
        'https://enb-crushers.vercel.app/image.png',
      webhookUrl: 'https://api.neynar.com/f/app/d2fa4ec7-a35c-42b1-811e-2f576f09bab8/event',
      subtitle: 'Fast, Simple, Onchain',
      description: 'earn ENB daily on Farcaster',
      "screenshotUrls": [
      "https://enb-crushers.vercel.app/IMG_1781.jpg",
      "https://enb-crushers.vercel.app/IMG_1782.jpg",
      "https://enb-crushers.vercel.app/IMG_1780.jpg"
    ],
      primaryCategory: 'finance',
     tags: [
      "daily",
      "mining",
      "claim",
      "earn"
    ],
      tagline: 'Fast, Simple, Onchain',
      ogTitle: 'ENB Mining',
      ogDescription: 'earn ENB daily on Farcaster',
      ogImageUrl:
        'https://enb-crushers.vercel.app/og-image.png',
      castShareUrl: 'https://enb-crushers.vercel.app/',
    },
   "baseBuilder": {
    "allowedAddresses": ["0x63526F05d9237DA102bce72960e13Ac4F2A3c3A9"]
    },
  };

  return NextResponse.json(config);
}

export const runtime = 'edge';
