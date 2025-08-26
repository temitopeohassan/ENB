import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering to prevent static generation issues on Vercel
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: "Address parameter is required" },
        { status: 400 }
      );
    }

    // TODO: Implement your actual account checking logic here
    // This could be:
    // 1. Check your database for an account record
    // 2. Check if there's a profile associated with this address
    // 3. Verify account creation status
    
    // For now, I'll simulate the check - replace this with your actual logic
    // You might want to check:
    // - Database records
    // - On-chain data
    // - User profiles
    // - Account creation timestamps
    
    // Example implementation:
    // const hasAccount = await checkDatabaseForAccount(address);
    // const hasAccount = await checkOnChainAccount(address);
    
    // For demonstration, let's assume accounts are created for addresses that start with '0x1'
    // Replace this with your actual logic
    const hasAccount = address.startsWith('0x1') && address.length === 42;

    return NextResponse.json({
      hasAccount,
      address,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error checking account status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
