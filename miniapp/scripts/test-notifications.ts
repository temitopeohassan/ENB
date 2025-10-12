// scripts/test-notifications.ts
// Run this with: npx tsx scripts/test-notifications.ts

import { 
    setUserNotificationDetails, 
    getUserNotificationDetails, 
    sendMiniAppNotification,
    deleteUserNotificationDetails 
  } from "../lib/miniapp-notification";
  
  async function testNotificationFlow() {
    console.log("🧪 Starting notification system test...\n");
  
    // Test data
    const testFid = 708707;
    const testNotificationDetails = {
      token: "test-token-" + Date.now(),
      url: "https://test-flight-six.vercel.app/webhook" // Replace with your actual endpoint
    };
  
    try {
      // Test 1: Store notification details
      console.log("📝 Test 1: Storing notification details...");
      await setUserNotificationDetails({ fid: testFid }, testNotificationDetails);
      console.log("✅ Storage test passed\n");
  
      // Test 2: Retrieve notification details
      console.log("📖 Test 2: Retrieving notification details...");
      const retrieved = await getUserNotificationDetails({ fid: testFid });
      if (retrieved) {
        console.log("✅ Retrieval test passed");
        console.log("Retrieved:", {
          hasToken: Boolean(retrieved.token),
          hasUrl: Boolean(retrieved.url),
          tokenMatch: retrieved.token === testNotificationDetails.token,
          urlMatch: retrieved.url === testNotificationDetails.url,
        });
      } else {
        console.log("❌ Retrieval test failed - no data found");
        return;
      }
      console.log("");
  
      // Test 3: Send notification (this will likely fail unless you have a real endpoint)
      console.log("📤 Test 3: Sending test notification...");
      const result = await sendMiniAppNotification({
        fid: testFid,
        title: "Test Notification",
        body: "This is a test notification from your mini app",
        targetUrl: "https://enb-crushers.vercel.app/test",
        notificationId: "test-" + Date.now(),
      });
      
      if (result) {
        console.log("✅ Notification sent successfully");
        console.log("Result:", {
          successful: result.successfulTokens.length,
          invalid: result.invalidTokens.length,
          rateLimited: result.rateLimitedTokens.length,
        });
      } else {
        console.log("⚠️ Notification sending returned null (expected for test endpoint)");
      }
      console.log("");
  
      // Test 4: Delete notification details
      console.log("🗑️ Test 4: Deleting notification details...");
      await deleteUserNotificationDetails({ fid: testFid });
      
      const deletedCheck = await getUserNotificationDetails({ fid: testFid });
      if (!deletedCheck) {
        console.log("✅ Deletion test passed");
      } else {
        console.log("❌ Deletion test failed - data still exists");
      }
  
      console.log("\n🎉 Test completed!");
  
    } catch (error) {
      console.error("💥 Test failed with error:", error);
    }
  }
  
  // Run the test
  testNotificationFlow().catch(console.error);