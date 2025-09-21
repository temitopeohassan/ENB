import { NextResponse } from 'next/server';

export async function GET() {
  const config = {
    accountAssociation: {
   "header": "eyJmaWQiOjczODU3NCwidHlwZSI6ImF1dGgiLCJrZXkiOiIweGRiMjk3OWZkRjY4OTU3MUREMTYyN0E2MzNkNjk3MTZEMzlkOTE5RGMifQ",
    "payload": "eyJkb21haW4iOiJtaW5pbmcuZW5iLmZ1biJ9",
    "signature": "slBX9ir3ehRseMgdNhlym/QvlTlFJFURpYM9fjhPhaFRb2KdOWTKahrgD2V+N14SsiljXJCHKLXaxUJpQuXx0hs="
    },
    frame: {
      version: '1',
      name: 'ENB Mining',
      iconUrl: 'https://mining.enb.fun/icon.png',
      splashImageUrl: 'https://mining.enb.fun/splash.png',
      splashBackgroundColor: '#A93445',
      homeUrl: 'https://mining.enb.fun/',
      imageUrl: 'https://mining.enb.fun/image.png',
      buttonTitle: 'Start Mining',
      heroImageUrl:
        'https://mining.enb.fun/image.png',
      webhookUrl: 'https://mining.enb.fun/api/webhook',
      subtitle: 'Fast, Simple, Onchain',
      description: 'earn ENB daily on Farcaster',
      "screenshotUrls": [
      "https://mining.enb.fun/IMG_1781.jpg",
      "https://mining.enb.fun/IMG_1782.jpg",
      "https://mining.enb.fun/IMG_1780.jpg"
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
        'https://mining.enb.fun/og-image.png',
      castShareUrl: 'https://mining.enb.fun/',
    },
   baseBuilder: {
    "allowedAddresses": ["0x63526F05d9237DA102bce72960e13Ac4F2A3c3A9"]
    },
  };

  return NextResponse.json(config);
}

export const runtime = 'edge';
