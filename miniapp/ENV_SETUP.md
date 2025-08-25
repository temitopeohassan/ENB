# Environment Variables Setup for Neynar Notifications

Create a `.env.local` file in your project root with the following variables:

## Required Neynar Variables

```bash
# Neynar Configuration
NEYNAR_API_KEY=your_neynar_api_key_here
NEYNAR_CLIENT_ID=your_neynar_client_id_here
NEYNAR_WEBHOOK_URL=https://api.neynar.com/f/app/YOUR_CLIENT_ID/event
```

## Required Farcaster Variables

```bash
# Farcaster Configuration
FARCASTER_HEADER=your_farcaster_header_here
FARCASTER_PAYLOAD=your_farcaster_payload_here
FARCASTER_SIGNATURE=your_farcaster_signature_here
```

## Required App Variables

```bash
# App Configuration
NEXT_PUBLIC_URL=https://your-domain.com
NEXT_PUBLIC_VERSION=1.0.0
NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME=ENB Mini App
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your_onchainkit_api_key_here
NEXT_PUBLIC_ICON_URL=https://your-domain.com/icon.png
NEXT_PUBLIC_IMAGE_URL=https://your-domain.com/image.png
NEXT_PUBLIC_SPLASH_IMAGE_URL=https://your-domain.com/splash.png
NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR=0052FF
```

## How to Get These Values

### 1. Neynar API Key & Client ID
1. Go to [dev.neynar.com](https://dev.neynar.com)
2. Sign up/login to your account
3. Create a new app or select existing app
4. Copy the API key and client ID from your app dashboard

### 2. Neynar Webhook URL
The webhook URL format is: `https://api.neynar.com/f/app/YOUR_CLIENT_ID/event`
Replace `YOUR_CLIENT_ID` with your actual Neynar client ID.

### 3. Farcaster Variables
These are generated when you set up your Farcaster account association. You can get them from:
- Your Farcaster developer tools
- Or use Neynar's account association service

### 4. App Configuration
- `NEXT_PUBLIC_URL`: Your deployed app URL (e.g., `https://your-app.vercel.app`)
- `NEXT_PUBLIC_ONCHAINKIT_API_KEY`: Get from [onchainkit.com](https://onchainkit.com)
- Image URLs: Upload your images and use the public URLs

## Important Notes

1. **Never commit `.env.local` to version control**
2. **Restart your development server** after adding environment variables
3. **Verify all URLs are accessible** from the internet
4. **Check browser console** for any configuration errors
