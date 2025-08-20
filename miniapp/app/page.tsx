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
import { sdk } from "@farcaster/miniapp-sdk";

export default function App() {
  const { isConnected, address } = useAccount();
  const { connect } = useConnect();
  const [activeTab, setActiveTabAction] = useState("account");
  const [miniAppAdded, setMiniAppAdded] = useState(false);
  const [isCheckingMiniApp, setIsCheckingMiniApp] = useState(true);
  const frameConnector = useMemo(() => farcasterFrame(), []);
  
  // Simple notification state
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationToken, setNotificationToken] = useState<string | null>(null);
  
  // Function to enable notifications (for testing)
  const enableNotifications = useCallback(() => {
    // In a real app, this would be handled by the Neynar SDK
    // For now, we'll simulate it with a test token
    const testToken = `test-token-${Date.now()}`;
    setNotificationToken(testToken);
    setNotificationEnabled(true);
    console.log('🔔 Notifications enabled with test token:', testToken);
  }, []);

  // Check if mini app is already added
  useEffect(() => {
    const checkMiniAppStatus = async () => {
      try {
        setIsCheckingMiniApp(true);
        // For now, we'll assume the mini app is not added
        // The actual status will be determined when the user tries to add it
        setMiniAppAdded(false);
      } catch (err) {
        console.error("Failed to check mini app status:", err);
        setMiniAppAdded(false);
      } finally {
        setIsCheckingMiniApp(false);
      }
    };

    checkMiniAppStatus();
  }, []);

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
      sdk.actions.ready();
    } catch (err) {
      console.error("Failed to signal Mini App readiness:", err);
    }
  }, []);

  const handleAddMiniApp = useCallback(async () => {
    try {
      await sdk.actions.addMiniApp();
      setMiniAppAdded(true);
      console.log("✅ Mini app added successfully");
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
          setMiniAppAdded(true);
        } else {
          console.error("Unknown error adding Mini App:", err.message);
        }
      } else {
        console.error("Non-standard error occurred while adding Mini App:", err);
      }
      // Keep the state as false if adding failed (unless it's already added)
      if (!(err instanceof Error && (err.name === "AlreadyAdded" || err.message?.includes("already added")))) {
        setMiniAppAdded(false);
      }
    }
  }, []);

  // Function to send notifications using Neynar API
  const sendNotification = useCallback(async (title: string, body: string) => {
    try {
      // Check if we have notification token
      if (notificationToken) {
        console.log('📱 Notification token available:', notificationToken);
        console.log('📋 Sending notification:', { title, body });
        
        // Prepare notification data
        const notificationData = {
          notificationId: `enb-${Date.now()}`,
          title,
          body,
          targetUrl: window.location.href,
          tokens: [notificationToken]
        };
        
        console.log('📤 Notification payload:', notificationData);
        
        // Send notification via our API endpoint
        try {
          const apiResponse = await fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(notificationData)
          });
          
          if (apiResponse.ok) {
            const result = await apiResponse.json();
            console.log('✅ API response:', result);
            // Show success feedback
            console.log('✅ Notification sent successfully');
          } else {
            console.error('❌ API error:', apiResponse.status);
          }
        } catch (apiError) {
          console.error('❌ API call failed:', apiError);
        }
        
      } else {
        console.warn('⚠️ Notifications not enabled or token not available');
      }
    } catch (error) {
      console.error('❌ Failed to send notification:', error);
    }
  }, [notificationToken]);

  // Function to send test notification
  const sendTestNotification = useCallback(() => {
    sendNotification(
      'ENB Mini App Update', 
      'Your daily mining rewards are ready to claim! 🎉'
    );
  }, [sendNotification]);

  const addButton = useMemo(() => {
    // Don't show anything while checking mini app status
    if (isCheckingMiniApp) {
      return null;
    }

    // If mini app is already added, show the "Added" indicator
    if (miniAppAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-[#0052FF]">
          <Icon name="check" size="sm" className="text-[#0052FF]" />
          <span>Added</span>
        </div>
        );
    }

    // Show add button if mini app is not added
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleAddMiniApp}
        className="text-[var(--app-accent)] p-4"
        icon={<Icon name="plus" size="sm" />}
      >
        Add Mini App
      </Button>
    );
  }, [miniAppAdded, isCheckingMiniApp, handleAddMiniApp]);

  // Notification status indicator
  const notificationStatus = useMemo(() => {
    if (notificationToken) {
      return (
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-sm font-medium text-green-600">
            <Icon name="check" size="sm" className="text-green-600" />
            <span>Notifications Enabled</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={sendTestNotification}
            className="text-blue-600 hover:text-blue-800 p-2"
            icon={<Icon name="star" size="sm" />}
          >
            Test
          </Button>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-2">
        <div className="flex items-center space-x-1 text-sm text-orange-600">
          <Icon name="heart" size="sm" className="text-orange-600" />
          <span>Notifications Disabled</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={enableNotifications}
          className="text-orange-600 hover:text-orange-800 p-2"
          icon={<Icon name="plus" size="sm" />}
        >
          Enable
        </Button>
      </div>
    );
  }, [notificationToken, sendTestNotification, enableNotifications]);

  const truncateAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  // Tab navigation component
  const TabNavigation = () => {
    if (!isConnected) return null;

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

          <div className="flex items-center space-x-2">{addButton}</div>

          {/* Notification Status */}
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
                <div>Notifications Enabled: {notificationEnabled ? '✅' : '❌'}</div>
                <div>Notification Token: {notificationToken ? '✅' : '❌'}</div>
                {notificationToken && (
                  <div className="pl-4">
                    <div>Token: {notificationToken.substring(0, 20)}...</div>
                  </div>
                )}
                <div>Mini App Added: {miniAppAdded ? '✅' : '❌'}</div>
              </div>
            </div>
          )}
          
          {activeTab === "account" && <Account setActiveTabAction={setActiveTabAction} />}
          {activeTab === "create" && <Create setActiveTabAction={setActiveTabAction} />}
          {activeTab === "maintenance" && <Maintenance />}
        </main>

        <footer className="mt-2 pt-4 flex justify-center">ENB Mini App</footer>
      </div>
    </div>
  );
}
