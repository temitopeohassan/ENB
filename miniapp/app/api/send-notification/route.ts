import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { notificationId, title, body: messageBody, targetUrl, tokens } = body;

    // Validate required fields
    if (!notificationId || !title || !messageBody || !targetUrl || !tokens || !Array.isArray(tokens)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get Neynar API key from environment
    const neynarApiKey = process.env.NEYNAR_API_KEY;
    if (!neynarApiKey) {
      return NextResponse.json(
        { error: 'Neynar API key not configured' },
        { status: 500 }
      );
    }

    // Prepare notification payload for Neynar Frame Notifications API
    const notificationPayload = {
      target_fids: [], // Empty array means target all users with notifications enabled
      notification: {
        title,
        body: messageBody,
        target_url: targetUrl,
      },
      // Optional filters
      filters: {
        // You can add filters here if needed
        // exclude_fids: [],
        // minimum_user_score: 0.5,
        // following_fid: 3,
      }
    };

    console.log('📤 Sending notification to Neynar Frame API:', notificationPayload);

    // Send notification via Neynar Frame Notifications API
    const response = await fetch('https://api.neynar.com/v2/farcaster/frame/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_key': neynarApiKey,
      },
      body: JSON.stringify(notificationPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Neynar Frame API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to send notification: ${response.status}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    console.log('✅ Notification sent successfully:', result);

    return NextResponse.json({
      success: true,
      result,
      message: 'Notification sent successfully'
    });

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
