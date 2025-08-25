'use client';

import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "./components/Button";
import { Icon } from "./components/Icon";
import { Account } from "./components/Account";
import { Create } from "./components/Create";
import { Maintenance } from "./components/Maintenance";
import { useAccount, useConnect } from "wagmi";
import { farcasterFrame } from '@farcaster/frame-wagmi-connector';
import Image from "next/image";
import farcasterSDK from "@farcaster/miniapp-sdk";

export default function App() {
  const { isConnected, address } = useAccount();
  const { connect } = useConnect();
  const [activeTab, setActiveTabAction] = useState("account");
  const frameConnector = useMemo(() => farcasterFrame(), []);
  
  // Notification state
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  
  // Check mini app status when app loads
  useEffect(() => {
    const checkMiniAppStatus = async () => {
      try {
        setIsCheckingStatus(true);
        
        // Check if we're in a Farcaster mini app context
        const isInMiniApp = await farcasterSDK.isInMiniApp();
        
        if (isInMiniApp) {
          // We're in a Farcaster mini app context, so it's already added
          setNotificationEnabled(true);
          console.log("✅ Mini app is already added (detected via isInMiniApp)");
        } else {
          // Not in mini app context, check if we can access mini app actions
          try {
            // Try to call ready() - if it succeeds, the mini app might be added
            await farcasterSDK.actions.ready();
            
            // If we get here, the mini app is likely added
            setNotificationEnabled(true);
            console.log("✅ Mini app appears to be already added (SDK ready)");
            
          } catch {
            // SDK error suggests mini app is not added
            setNotificationEnabled(false);
            console.log("ℹ️ Mini app not added yet (SDK not ready)");
          }
        }
        
      } catch (err) {
        console.error("Failed to check mini app status:", err);
        setNotificationEnabled(false);
      } finally {
        setIsCheckingStatus(false);
      }
    };

    checkMiniAppStatus();
  }, []);

  // Reset active tab to "account" when notifications are enabled
  useEffect(() => {
    if (notificationEnabled && !isCheckingStatus) {
      setActiveTabAction("account");
    }
  }, [notificationEnabled, isCheckingStatus]);

  // Auto-connect wallet if not connected
  useEffect(() => {
    const autoConnect = async () => {
      if (!isConnected) {
        try {
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
  }, [isConnected, connect, frameConnector]);

  // Notify Warpcast that the app is ready
  useEffect(() => {
    try {
      farcasterSDK.actions.ready();
    } catch (err) {
      console.error("Failed to signal Mini App readiness:", err);
    }
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    try {
      // Use the Farcaster mini app SDK to add the mini app
      await farcasterSDK.actions.addMiniApp();
      setNotificationEnabled(true);
      console.log("Mini app added and notifications enabled successfully");
      
    } catch (err: unknown) {
      console.log("🔍 Mini app add error details:", {
        error: err,
        name: err instanceof Error ? err.name : 'N/A',
        message: err instanceof Error ? err.message : 'N/A',
        constructor: err?.constructor?.name
      });
      
      if (err instanceof Error) {
        if (err.name === "RejectedByUser") {
          console.warn("User rejected adding the Mini App");
        } else if (err.name === "InvalidDomainManifestJson") {
          console.error("Manifest JSON is invalid");
        } else if (err.name === "AlreadyAdded" || err.message?.includes("already added")) {
          // Mini app is already added
          console.log("ℹ️ Mini app is already added");
          setNotificationEnabled(true);
        } else {
          console.error("Unknown error adding Mini App:", err.message);
        }
      } else {
        console.error("Non-standard error occurred while adding Mini App:", err);
      }
      // Keep the state as false if adding failed (unless it's already added)
      if (!(err instanceof Error && (err.name === "AlreadyAdded" || err.message?.includes("already added")))) {
        setNotificationEnabled(false);
      }
    }
  }, []);

  // Notification status indicator - only show when notifications are disabled
  const notificationStatus = useMemo(() => {
    // Don't show anything while checking status
    if (isCheckingStatus) {
      return null;
    }

    if (!notificationEnabled) {
      return (
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-sm text-orange-600">
            <Icon name="heart" size="sm" className="text-orange-600" />
            <span>Notifications Disabled</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEnableNotifications}
            className="text-orange-600 hover:text-orange-800 p-2"
            icon={<Icon name="plus" size="sm" />}
          >
            Enable
          </Button>
        </div>
      );
    }

    // Show nothing when notifications are enabled
    return null;
  }, [notificationEnabled, isCheckingStatus, handleEnableNotifications]);

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Tab navigation component
  const TabNavigation = () => {
    // Don't show tabs if not connected or if notifications are not enabled
    if (!isConnected || !notificationEnabled || isCheckingStatus) {
      return null;
    }

    const tabs = [
      { id: "account", label: "Account", icon: "user" },
      { id: "create", label: "Create", icon: "plus" }
    ];

    return (
      <div className="flex space-x-1 mb-6 bg-[var(--app-gray)] p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTabAction(tab.id)}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--app-background)] text-[var(--app-foreground)] shadow-sm"
                : "text-[var(--app-foreground-muted)] hover:text-[var(--app-foreground)]"
            }`}
          >
            <Icon name={tab.icon as "user" | "plus"} size="sm" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    );
  };

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

          {/* Notification Status - only show when disabled */}
          <div className="flex items-center space-x-2">
            {notificationStatus}
          </div>

          {address && (
            <div className="flex items-center space-x-2">
              <div className="px-3 py-1.5 bg-[var(--app-gray)] rounded-full text-sm font-medium">
                {truncateAddress(address)}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="w-full max-w-md mx-auto px-4 py-3 pt-20">
        <main className="flex-1">
          <TabNavigation />
          
          {/* Debug Information for Notifications */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-6 p-4 bg-gray-100 rounded-lg text-xs">
              <h3 className="font-semibold mb-2">🔍 Notification Debug Info</h3>
              <div className="space-y-1">
                <div>Status Checking: {isCheckingStatus ? '⏳ Checking...' : '✅ Complete'}</div>
                <div>Notifications Enabled: {notificationEnabled ? '✅ Yes' : '❌ No'}</div>
                <div>Mini App SDK Ready: ✅</div>
                <div>Farcaster SDK Import: ✅</div>
                <div>Tab Navigation: {(!isConnected || !notificationEnabled || isCheckingStatus) ? '❌ Hidden' : '✅ Visible'}</div>
                <div>Active Tab: {activeTab}</div>
                <div>Wallet Connected: {isConnected ? '✅ Yes' : '❌ No'}</div>
              </div>
            </div>
          )}
          
          {/* Show content only when notifications are enabled */}
          {notificationEnabled && !isCheckingStatus ? (
            <>
              {activeTab === "account" && <Account setActiveTabAction={setActiveTabAction} />}
              {activeTab === "create" && <Create setActiveTabAction={setActiveTabAction} />}
              {activeTab === "maintenance" && <Maintenance />}
            </>
          ) : (
            /* Show message when notifications are not enabled */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-6">
                <Icon name="heart" size="lg" className="text-orange-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Enable Notifications
                </h2>
                <p className="text-gray-600 max-w-sm">
                  To access the ENB Mini App features, please enable notifications by clicking the &quot;Enable&quot; button in the header.
                </p>
              </div>
            </div>
          )}
        </main>

        <footer className="mt-2 pt-4 flex justify-center">ENB Mini App</footer>
      </div>
    </div>
  );
}