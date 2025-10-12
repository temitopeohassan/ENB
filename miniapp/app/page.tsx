'use client';

import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "./components/Button";
import { Icon } from "./components/Icon";
import { Account } from "./components/Account";
import { Create } from "./components/Create";
import { Maintenance } from "./components/Maintenance";
import { Stats } from "./components/Stats";
import { Leaderboard } from "./components/Leaderboard";
import { TabNavigation } from "./components/TabNavigation";
import { useAccount, useConnect } from "wagmi";
import { farcasterFrame } from "@farcaster/frame-wagmi-connector";
import Image from "next/image";
import { sdk } from "@farcaster/miniapp-sdk";

export default function App() {
  const { isConnected, address } = useAccount();
  const { connect } = useConnect();
  const [activeTab, setActiveTabAction] = useState("account");
  const [miniAppAdded, setMiniAppAdded] = useState(false);
  const [fid, setFid] = useState<number | null>(null);
  const [isAddingMiniApp, setIsAddingMiniApp] = useState(false);
  const [isAccountActivated, setIsAccountActivated] = useState(false);
  const [isCheckingAccount, setIsCheckingAccount] = useState(true);
  const [isFarcasterEnv, setIsFarcasterEnv] = useState(true);
  const frameConnector = useMemo(() => farcasterFrame(), []);

  /** Detect Farcaster environment */
  useEffect(() => {
    const checkFarcasterEnv = () => {
      if (typeof window === 'undefined') return;
      
      const userAgent = navigator.userAgent.toLowerCase();
      const isFarcaster = userAgent.includes('farcaster') || 
                         userAgent.includes('warpcast') ||
                         document.referrer.includes('warpcast') ||
                         document.referrer.includes('farcaster');
      
      console.log('🔍 Environment detection:', {
        userAgent,
        isFarcaster,
        referrer: document.referrer
      });
      
      setIsFarcasterEnv(isFarcaster);
    };

    checkFarcasterEnv();
  }, []);

  /** Auto-connect wallet if not connected (Farcaster only) */
  useEffect(() => {
    const autoConnect = async () => {
      if (!isConnected && isFarcasterEnv) {
        try {
          console.log('🔗 Auto-connecting to Farcaster wallet...');
          await connect({ connector: frameConnector });
        } catch (err: unknown) {
          if (err instanceof Error) {
            console.error("Auto-connect failed:", err.message);
          } else {
            console.error("Auto-connect failed with unknown error:", err);
          }
        }
      }
    };
    autoConnect();
  }, [isConnected, isFarcasterEnv, connect, frameConnector]);

  /** Get FID from SDK context */
  const getFidFromContext = useCallback(async (): Promise<number | null> => {
    try {
      console.log("🔍 Attempting to get SDK context...");
      const context = await sdk.context;
      console.log("📋 Full SDK context received:", JSON.stringify(context, null, 2));

      const isRecord = (obj: unknown): obj is Record<string, unknown> =>
        typeof obj === "object" && obj !== null && !Array.isArray(obj);

      if (isRecord(context)) {
        const userVal = context["user"];
        console.log("👤 User object from context:", JSON.stringify(userVal, null, 2));
        console.log("👤 User object type:", typeof userVal);
        console.log("👤 User object keys:", userVal ? Object.keys(userVal) : 'null');
        
        if (isRecord(userVal)) {
          const fidVal = userVal["fid"];
          console.log("🔍 FID value:", fidVal);
          console.log("🔍 FID type:", typeof fidVal);
          
          if (typeof fidVal === "number") {
            console.log("✅ FID found:", fidVal);
            return fidVal;
          } else {
            console.log("❌ FID is not a number. Value:", fidVal, "Type:", typeof fidVal);
          }
        } else {
          console.log("❌ User value is not a record object");
        }
      } else {
        console.log("❌ Context is not a record object");
      }
      console.log("❌ No FID found in context - returning null");
      return null;
    } catch (err) {
      console.error("❌ Failed to fetch FID from context:", err);
      if (err instanceof Error) {
        console.error("   Error details:", {
          name: err.name,
          message: err.message,
          stack: err.stack
        });
      }
      return null;
    }
  }, []);

  /** Check on load whether Mini App is already added and capture fid */
  useEffect(() => {
    (async () => {
      try {
        console.log("🔍 Loading app - fetching SDK context...");
        const context = await sdk.context;
        console.log("📋 SDK context received:", context);

        const isRecord = (obj: unknown): obj is Record<string, unknown> =>
          typeof obj === "object" && obj !== null && !Array.isArray(obj);

        // Check if mini app is added
        if (isRecord(context)) {
          const clientVal = context["client"];
          console.log("📱 Client info:", clientVal);
          if (isRecord(clientVal) && clientVal["added"] === true) {
            console.log("✅ Mini app already added");
            setMiniAppAdded(true);
            localStorage.setItem("miniAppAdded", "true");
          }
        }

        // Capture fid if available
        const foundFid = await getFidFromContext();
        if (foundFid) {
          setFid(foundFid);
          console.log("✅ FID set in state:", foundFid);
        }
      } catch (err) {
        console.error("Failed to fetch context, falling back to localStorage", err);

      // fallback to saved state
      const stored = localStorage.getItem("miniAppAdded");
      if (stored === "true") {
          console.log("📦 Restoring mini app state from localStorage");
        setMiniAppAdded(true);
        }
      }
    })();
  }, [getFidFromContext]);

  /** Persist to localStorage when updated */
  useEffect(() => {
    localStorage.setItem("miniAppAdded", String(miniAppAdded));
  }, [miniAppAdded]);

  /** Log FID when Mini App is added */
  useEffect(() => {
    if (miniAppAdded && typeof fid === "number") {
      console.log("Mini App added for FID:", fid);
    }
  }, [miniAppAdded, fid]);

  /** Notify Warpcast the app is ready */
  useEffect(() => {
    try {
      sdk.actions.ready();
    } catch (err) {
      console.error("Failed to signal Mini App readiness:", err);
    }
  }, []);

  /** Check if account is activated and update FID if needed */
  useEffect(() => {
    const checkAccountStatus = async () => {
      console.log('🔍 Checking account status...', { address, isConnected });
      
      if (!address || !isConnected) {
        console.log('⚠️ No address or not connected');
        setIsCheckingAccount(false);
        setIsAccountActivated(false);
        return;
      }

      try {
        console.log('📡 Fetching profile from API...');
        const response = await fetch(`https://enb-api.vercel.app/api/profile/${address}`);
        
        console.log('📥 Profile API response status:', response.status);
        
        if (response.status === 404) {
          console.log('❌ Account not found (404)');
          setIsAccountActivated(false);
          setIsCheckingAccount(false);
          return;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Profile fetch failed:', response.status, errorText);
          throw new Error(`Failed to fetch profile: ${response.status}`);
        }

        const profile = await response.json();
        console.log('✅ Profile fetched:', { isActivated: profile.isActivated, fid: profile.fid });
        
        const isActivated = profile.isActivated === true;
        setIsAccountActivated(isActivated);
        console.log('🔧 Set isAccountActivated to:', isActivated);
        
        // Check if FID needs to be updated (only if activated)
        if (isActivated) {
          console.log('📋 Account is activated, checking FID...');
          try {
            console.log('🔍 Getting FID from context...');
            const currentFid = await getFidFromContext();
            console.log('📊 FID comparison:', {
              currentFid,
              profileFid: profile.fid,
              needsUpdate: currentFid && profile.fid !== currentFid
            });
            
            if (currentFid && profile.fid !== currentFid) {
              console.log(`🔄 FID needs updating: ${currentFid} (current in DB: ${profile.fid})`);
              console.log('📤 Sending FID update request to:', 'https://enb-api.vercel.app/api/update-fid');
              console.log('📦 Request payload:', {
                walletAddress: address,
                fid: currentFid
              });
              
              try {
                const updateResponse = await fetch('https://enb-api.vercel.app/api/update-fid', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    walletAddress: address,
                    fid: currentFid
                  }),
                });

                console.log('📥 FID update response status:', updateResponse.status);
                
                if (updateResponse.ok) {
                  const result = await updateResponse.json();
                  console.log('✅ FID updated successfully:', result);
                } else {
                  const errorText = await updateResponse.text();
                  console.error('❌ Failed to update FID:');
                  console.error('   Status:', updateResponse.status);
                  console.error('   Response:', errorText);
                }
              } catch (fidError) {
                console.error('❌ Network error updating FID:', fidError);
                if (fidError instanceof Error) {
                  console.error('   Error details:', {
                    name: fidError.name,
                    message: fidError.message,
                    stack: fidError.stack
                  });
                } else {
                  console.error('   Error details:', fidError);
                }
              }
            } else if (currentFid) {
              console.log(`✅ FID already up to date: ${currentFid}`);
            } else {
              console.log('⚠️ No FID available to update');
              console.log('   This means SDK context does not contain FID');
            }
          } catch (fidError) {
            console.error('❌ Error in FID check:', fidError);
            if (fidError instanceof Error) {
              console.error('   Error details:', {
                name: fidError.name,
                message: fidError.message,
                stack: fidError.stack
              });
            } else {
              console.error('   Error details:', fidError);
            }
            // Don't fail the whole flow if FID check fails
          }
        } else {
          console.log('⏭️ Skipping FID check - account not activated');
        }
      } catch (error) {
        console.error('❌ Error checking account status:', error);
        setIsAccountActivated(false);
      } finally {
        setIsCheckingAccount(false);
        console.log('✅ Account status check complete');
      }
    };

    checkAccountStatus();
  }, [address, isConnected, getFidFromContext]);

  /** Send welcome notification with better error handling */
  const sendWelcomeNotification = useCallback(async (userFid: number) => {
    try {
      const notificationData = {
        fid: userFid,
        title: "Welcome To ENB Mining",
        body: "Welcome to your mining journey, your Base layer has been activated",
        targetUrl: "https://mining.enb.fun/",
        notificationId: `welcome-${userFid}-${Date.now()}` // Make it unique
      };

      console.log("🔔 Sending notification with data:", notificationData);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch('https://mining.enb.fun/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log("📡 Notification API response status:", response.status);
      console.log("📡 Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ API error response:", errorText);
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Welcome notification sent successfully:', result);
      return result;
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          console.error("❌ Notification request timed out");
        } else {
          console.error("❌ Failed to send welcome notification:", err.message);
          console.error("Full error:", err);
        }
      } else {
        console.error("❌ Failed to send welcome notification with unknown error:", err);
      }
      throw err;
    }
  }, []);

  /** Handle Add Mini App with improved flow */
  const handleAddMiniApp = useCallback(async () => {
    if (isAddingMiniApp) {
      console.log("⏳ Mini app addition already in progress");
      return;
    }

    setIsAddingMiniApp(true);
    
    try {
      console.log("🚀 Starting to add mini app...");
      
      // First, try to get the current FID
      let currentFid = await getFidFromContext();
      if (!currentFid) {
        currentFid = fid; // Fallback to stored FID
      }
      
      console.log("🆔 Current FID before adding:", currentFid);
      
      // Add the mini app
      await sdk.actions.addMiniApp();
      console.log("✅ Mini app added successfully");
      
      // Update state
      setMiniAppAdded(true);
      
      // Wait a moment for the context to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Try to get FID again after adding mini app
      const updatedFid = await getFidFromContext();
      const fidToUse = updatedFid || currentFid;
      
      console.log("🆔 FID to use for notification:", fidToUse);
      console.log("🆔 Updated FID:", updatedFid, "Fallback FID:", currentFid);
      
      // Update FID state if we got a new one
      if (updatedFid && updatedFid !== fid) {
        setFid(updatedFid);
      }
      
      // Send welcome notification if we have the FID
      if (typeof fidToUse === "number") {
        console.log("📨 Attempting to send welcome notification for FID:", fidToUse);
        try {
          await sendWelcomeNotification(fidToUse);
          console.log("✅ Welcome notification sent successfully");
        } catch (notificationErr) {
          console.error("❌ Failed to send welcome notification:", notificationErr);
          // Don't throw here - the mini app was still added successfully
        }
      } else {
        console.warn("⚠️ No FID available, skipping welcome notification");
        console.warn("Current state - FID:", fid, "Context FID:", updatedFid);
      }
      
    } catch (err: unknown) {
      console.error("❌ Error in handleAddMiniApp:", err);
      
      if (err instanceof Error) {
        if (err.name === "RejectedByUser") {
          console.warn("👤 User rejected adding the Mini App");
        } else if (err.name === "InvalidDomainManifestJson") {
          console.error("📄 Manifest JSON is invalid");
        } else {
          console.error("🚫 Unknown error adding Mini App:", err.message);
        }
      } else {
        console.error("🚫 Non-standard error occurred while adding Mini App:", err);
      }
    } finally {
      setIsAddingMiniApp(false);
    }
  }, [fid, sendWelcomeNotification, getFidFromContext, isAddingMiniApp]);

  /** Handle tab change with account status refresh */
  const handleTabChange = useCallback(async (tab: string) => {
    setActiveTabAction(tab);
    
    // Refresh account status when changing to account tab
    if (tab === 'account' && address && isConnected) {
      try {
        const response = await fetch(`https://mining.enb.fun/api/profile/${address}`);
        if (response.ok) {
          const profile = await response.json();
          setIsAccountActivated(profile.isActivated === true);
        }
      } catch (error) {
        console.error('Error refreshing account status:', error);
      }
    }
  }, [address, isConnected]);

  /** Utility: truncate address */
  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <header className="fixed top-0 left-0 right-0 bg-[var(--app-background)] border-b border-[var(--app-gray)] z-50">
        <div className="w-full max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image
              src="/header-logo.png"
              alt="ENB Mini App Logo"
              width={40}
              height={40}
              className="rounded-lg"
            />
            <h1 className="text-xl font-bold">ENB MINI APP</h1>
          </div>

          {/* Add Mini App button - only show if not added and in Farcaster env */}
          {!miniAppAdded && isFarcasterEnv && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddMiniApp}
              disabled={isAddingMiniApp}
              className="text-[var(--app-accent)] p-4"
              icon={<Icon name="plus" size="sm" />}
            >
              {isAddingMiniApp ? "Adding..." : "Add Mini App"}
            </Button>
          )}

          {/* Connect Wallet button - only show if not connected and NOT in Farcaster env */}
          {!isConnected && !isFarcasterEnv && (
            <appkit-button />
          )}

          {address && (
            <div className="flex items-center space-x-2">
              <div className="px-3 py-1.5 bg-[var(--app-gray)] rounded-full text-sm font-medium">
                {truncateAddress(address)}
              </div>
              {/* Show network button for non-Farcaster env */}
              {!isFarcasterEnv && isConnected && (
                <appkit-network-button />
              )}
            </div>
          )}
        </div>
      </header>

      <div className={`w-full max-w-md mx-auto px-4 py-3 pt-20 ${isAccountActivated ? 'pb-20' : ''}`}>
        <main className="flex-1">
          {isCheckingAccount && address && (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Checking account status...</p>
              </div>
            </div>
          )}
          
          {!isCheckingAccount && activeTab === "account" && <Account setActiveTabAction={handleTabChange} />}
          {!isCheckingAccount && activeTab === "create" && <Create setActiveTabAction={handleTabChange} />}
          {!isCheckingAccount && activeTab === "stats" && <Stats />}
          {!isCheckingAccount && activeTab === "leaderboard" && <Leaderboard />}
          {!isCheckingAccount && activeTab === "maintenance" && <Maintenance />}
        </main>

        {!isAccountActivated && !isCheckingAccount && (
        <footer className="mt-2 pt-4 flex justify-center">ENB Mini App</footer>
        )}
      </div>

      {/* Tab Navigation - only show when account is activated */}
      {isAccountActivated && (
        <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      )}
    </div>
  );
}