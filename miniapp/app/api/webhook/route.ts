import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering to prevent static generation issues on Vercel
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const requestJson = await request.json();
    console.log("Webhook event received:", requestJson);

    // Simple webhook that just logs events
    // In production, you might want to handle specific events
    // For now, we'll just acknowledge receipt

    return NextResponse.json({ 
      success: true, 
      message: "Webhook received successfully",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: "Failed to process webhook" 
      },
      { status: 500 }
    );
  }
}
