'use client';

import { useEffect, useMemo, useState, useCallback } from "react";
import { Button } from "./components/Button";
import { Icon } from "./components/Icon";
import { Account } from "./components/Account";
import { Create } from "./components/Create";
import { useAccount, useConnect } from "wagmi";
import { farcasterFrame } from '@farcaster/frame-wagmi-connector';
import Image from "next/image";
import { sdk } from "@farcaster/miniapp-sdk";

export default function App() {
  const { isConnected, address } = useAccount();
  const { connect } = useConnect();
  const [miniAppAdded, setMiniAppAdded] = useState(false);
  const [hasAccount, setHasAccount] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const frameConnector = useMemo(() => farcasterFrame(), []);

  // On mount: check via SDK whether app is already added
  useEffect(() => {
    (async () => {
      try {
        const context = await sdk.context;
        if (context?.client?.added === true) {
          setMiniAppAdded(true);
          localStorage.setItem("miniAppAdded", "true");
        } else {
          const stored = localStorage.getItem("miniAppAdded");
          if (stored === "true") setMiniAppAdded(true);
        }
      } catch (err) {
        console.error("Failed to get context; fallback to localStorage", err);
        const stored = localStorage.getItem("miniAppAdded");
        if (stored === "true") setMiniAppAdded(true);
      }
    })();
  }, []);

  // Persist miniAppAdded to localStorage
  useEffect(() => {
    localStorage.setItem("miniAppAdded", String(miniAppAdded));
  }, [miniAppAdded]);

  // Auto-connect wallet
  useEffect(() => {
    const autoConnect = async () => {
      if (!isConnected) {
        try {
          await connect({ connector: frameConnector });
        } catch (err: unknown) {
          if (err instanceof Error) console.error("Auto-connect failed:", err.message);
          else console.error("Auto-connect failed:", err);
        }
      }
    };
    autoConnect();
  }, [isConnected, connect, frameConnector]);

  // Check account creation status
  useEffect(() => {
    const checkAccountStatus = async () => {
      if (!address) {
        setHasAccount(null);
        return;
      }
      setIsLoading(true);
      try {
        const response = await fetch(`/api/check-account?address=${address}`);
        if (response.ok) {
          const data = await response.json();
          setHasAccount(data.hasAccount);
        } else {
          setHasAccount(false);
        }
      } catch (error) {
        console.error("Failed to check account status:", error);
        setHasAccount(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAccountStatus();
  }, [address]);

  // Notify Warpcast that the app is ready
  useEffect(() => {
    try {
      sdk.actions.ready();
    } catch (err) {
      console.error("Failed to signal Mini App readiness:", err);
    }
  }, []);

  // Handle adding Mini App
  const handleAddMiniApp = useCallback(async () => {
    try {
      await sdk.actions.addMiniApp();
      setMiniAppAdded(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === "RejectedByUser") {
          console.warn("User rejected adding the Mini App");
        } else if (err.name === "InvalidDomainManifestJson") {
          console.error("Manifest JSON is invalid");
        } else {
          console.error("Unknown error adding Mini App:", err.message);
        }
      } else {
        console.error("Non-standard error occurred while adding Mini App:", err);
      }
    }
  }, []);

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const renderMainContent = () => {
    if (isLoading) return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--app-accent)] mx-auto mb-4"></div>
          <p className="text-[var(--app-foreground-muted)]">Checking account status...</p>
        </div>
      </div>
    );

    if (hasAccount === null) return null;
    return hasAccount ? <Account setActiveTabAction={() => {}} /> : <Create setActiveTabAction={() => {}} />;
  };

  return (
    <div className="flex flex-col min-h-screen font-sans text-[var(--app-foreground)] mini-app-theme from-[var(--app-background)] to-[var(--app-gray)]">
      <header className="fixed top-0 left-0 right-0 bg-[var(--app-background)] border-b border-[var(--app-gray)] z-50">
        <div className="w-full max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image src="/header-logo.png" alt="ENB Mini App Logo" width={40} height={40} className="rounded-lg" />
            <h1 className="text-xl font-bold">ENB MINI APP</h1>
          </div>

          {/* Only show Add Mini App button if it’s not already added */}
          {!miniAppAdded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddMiniApp}
              className="text-[var(--app-accent)] p-4"
              icon={<Icon name="plus" size="sm" />}
            >
              Add Mini App
            </Button>
          )}

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
        <main className="flex-1">{renderMainContent()}</main>
        <footer className="mt-2 pt-4 flex justify-center">ENB Mini App</footer>
      </div>
    </div>
  );
}
