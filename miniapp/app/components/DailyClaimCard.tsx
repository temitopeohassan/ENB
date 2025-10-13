'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

interface ClaimStatus {
  canClaim: boolean;
  timeLeft: {
    hours: number;
    minutes: number;
    seconds: number;
  };
  countdown: {
    eligibilityTime: string;
    progress: number;
  };
  metadata: {
    isFirstTimeUser: boolean;
    totalDaysSinceCreation: number;
    cooldownHours: number;
  };
}

interface DailyClaimCardProps {
  claimStatus: ClaimStatus;
  profile: { isActivated: boolean; fid?: number | null };
  address: string | undefined;
  dailyClaimLoading: boolean;
  onDailyClaim: () => void;
  onRefreshMining?: () => void;
}

export const DailyClaimCard: React.FC<DailyClaimCardProps> = ({
  claimStatus,
  profile,
  address,
  dailyClaimLoading,
  onDailyClaim,
  onRefreshMining
}) => {
  const notificationSentRef = useRef(false);
  const previousCanClaimRef = useRef(claimStatus.canClaim);
  const [userFid, setUserFid] = useState<number | null>(null);

  /** Fetch FID from backend */
  useEffect(() => {
    const fetchFid = async () => {
      if (!address) {
        console.log('⚠️ No address available to fetch FID');
        return;
      }

      try {
        console.log('🔍 Fetching FID from backend for address:', address);
        const response = await fetch(`https://enb-api.vercel.app/api/profile/${address}`);
        
        if (!response.ok) {
          console.error('❌ Failed to fetch profile for FID:', response.status);
          return;
        }

        const profileData = await response.json();
        console.log('📋 Profile data received:', { fid: profileData.fid, address: profileData.walletAddress });
        
        if (profileData.fid) {
          setUserFid(profileData.fid);
          console.log('✅ FID set from backend:', profileData.fid);
        } else {
          console.warn('⚠️ No FID in profile data');
        }
      } catch (error) {
        console.error('❌ Error fetching FID from backend:', error);
      }
    };

    fetchFid();
  }, [address]);

  /** Send claim ready notification */
  const sendClaimReadyNotification = useCallback(async (userFid: number) => {
    try {
      const notificationData = {
        fid: userFid,
        title: "Your Claim Has Been Refreshed",
        body: "You are able to claim ENB again",
        targetUrl: "https://mining.enb.fun",
        notificationId: `claim-ready-${userFid}-${Date.now()}`
      };

      console.log("🔔 Sending claim ready notification:", notificationData);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('https://mining.enb.fun/api/send-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notificationData),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log("📡 Claim notification response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Claim notification error:", errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Claim ready notification sent successfully:', result);
      return result;
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          console.error("❌ Claim notification request timed out");
        } else {
          console.error("❌ Failed to send claim notification:", err.message);
        }
      } else {
        console.error("❌ Failed to send claim notification:", err);
      }
    }
  }, []);

  /** Detect when countdown hits zero and send notification */
  useEffect(() => {
    const wasUnavailable = previousCanClaimRef.current === false;
    const isNowAvailable = claimStatus.canClaim === true;
    
    console.log('🔍 Countdown check:', {
      wasUnavailable,
      isNowAvailable,
      notificationSent: notificationSentRef.current,
      userFid,
      shouldSendNotification: wasUnavailable && isNowAvailable && !notificationSentRef.current
    });
    
    // Countdown just reached zero (transitioned from unavailable to available)
    if (wasUnavailable && isNowAvailable && !notificationSentRef.current) {
      console.log('⏰ COUNTDOWN REACHED ZERO! Claim is now available.');
      console.log('   Previous state: canClaim =', previousCanClaimRef.current);
      console.log('   Current state: canClaim =', claimStatus.canClaim);
      
      // Send notification if we have FID from backend
      if (userFid) {
        console.log('📨 Sending claim ready notification for FID (from backend):', userFid);
        console.log('   Notification not yet sent, proceeding...');
        sendClaimReadyNotification(userFid).then(() => {
          console.log('✅ Notification sent, marking as sent');
          notificationSentRef.current = true;
        }).catch((err) => {
          console.error('❌ Failed to send notification:', err);
        });
      } else {
        console.warn('⚠️ No FID available from backend, cannot send notification');
        console.warn('   Address:', address);
        console.warn('   Profile FID:', profile.fid);
        console.warn('   UserFid state:', userFid);
      }
    }
    
    // Reset notification sent flag when claim becomes unavailable again
    if (!claimStatus.canClaim && notificationSentRef.current) {
      console.log('🔄 Resetting notification flag - claim is now unavailable');
      notificationSentRef.current = false;
    }
    
    // Update previous state
    previousCanClaimRef.current = claimStatus.canClaim;
  }, [claimStatus.canClaim, userFid, sendClaimReadyNotification, address, profile.fid]);

  const handleClaim = async () => {
    // Trigger immediate refresh for better UX
    window.dispatchEvent(new CustomEvent('refreshMiningActivity'));
    
    await onDailyClaim();
    
    // Additional refresh after claim processing
    if (onRefreshMining) {
      setTimeout(() => {
        onRefreshMining();
      }, 1000); // Wait a bit for the backend to process
    }
  };

  return (
    <div id="daily-claim-section" className="bg-white p-6 rounded-lg shadow-md border">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Daily Claim</h2>
      <div className="space-y-4">
        
        {/* Enhanced Countdown Timer with Progress Bar */}
        {!claimStatus.canClaim && claimStatus.countdown.eligibilityTime && (
          <div key={`countdown-${claimStatus.countdown.eligibilityTime}-${claimStatus.canClaim}`} className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">
              {claimStatus.metadata.isFirstTimeUser 
                ? 'First claim available in:' 
                : 'Next claim available in:'
              }
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${claimStatus.countdown.progress}%` }}
              ></div>
            </div>
            
            {/* Countdown Timer */}
            <div className="text-2xl font-bold text-gray-800 font-mono mb-2">
              {String(claimStatus.timeLeft.hours).padStart(2, '0')}:
              {String(claimStatus.timeLeft.minutes).padStart(2, '0')}:
              {String(claimStatus.timeLeft.seconds).padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-500 mb-2">HH:MM:SS</div>
            
            {/* Additional Info */}
            <div className="text-xs text-gray-600 space-y-1">
              <div>Progress: {claimStatus.countdown.progress.toFixed(1)}%</div>
              {claimStatus.metadata.isFirstTimeUser && (
                <div>Account age: {claimStatus.metadata.totalDaysSinceCreation} days</div>
              )}
              <div>Cooldown: {claimStatus.metadata.cooldownHours} hours</div>
            </div>
            
          </div>
        )}

        {/* Loading State for Countdown */}
        {!claimStatus.canClaim && !claimStatus.countdown.eligibilityTime && (
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">
              Loading countdown information...
            </div>
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        )}

        {/* Claim Available Message */}
        {claimStatus.canClaim && (
          <div key={`claim-available-${claimStatus.countdown.eligibilityTime}-${claimStatus.canClaim}`} className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-sm text-green-600 font-medium mb-2">
              ✓ Daily claim is now available!
            </div>
            {claimStatus.metadata.isFirstTimeUser && (
              <div className="text-xs text-green-500">
                🎉 First time claiming! Welcome to ENB Mining!
              </div>
            )}
          </div>
        )}

        <button
          disabled={dailyClaimLoading || !profile?.isActivated || !claimStatus.canClaim || !address}
          onClick={handleClaim}
          className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
            claimStatus.canClaim && profile?.isActivated && address
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          } disabled:opacity-60`}
        >
          {dailyClaimLoading 
            ? 'Claiming...' 
            : !address
            ? 'Connect Wallet'
            : !profile?.isActivated
            ? 'Account Not Activated'
            : claimStatus.canClaim 
            ? 'Claim Daily Rewards' 
            : 'Claim Unavailable'
          }
        </button>
      </div>
    </div>
  );
};
