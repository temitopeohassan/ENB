'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { ENB_TOKEN_ABI, ENB_TOKEN_ADDRESS } from '../constants/enbMiniAppAbi';
import { API_BASE_URL } from '../config';
import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import { sdk } from '@farcaster/frame-sdk';
import { UserProfile, ClaimStatus, TipStep } from '../types/account';

export const useAccountLogic = () => {
  const { address } = useAccount();
  
  // State
  const [showDailyClaimModal, setShowDailyClaimModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showBoosterModal, setShowBoosterModal] = useState(false);
  const [showInformationModal, setInformationModal] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [dailyClaimLoading, setDailyClaimLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [profileRefreshLoading, setProfileRefreshLoading] = useState(false);
  const [profileRefreshSuccess, setProfileRefreshSuccess] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enbBalance, setEnbBalance] = useState<number>(0);
  const [enbBalanceLoading, setEnbBalanceLoading] = useState(false);
  
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>({
    canClaim: false,
    timeLeft: { hours: 0, minutes: 0, seconds: 0 },
    nextClaimTime: null,
    lastClaimTime: null,
    countdown: {
      timeUntilEligibility: 0,
      eligibilityTime: '',
      countdownComponents: { totalSeconds: 0, hours: 0, minutes: 0, seconds: 0 },
      progress: 0,
      cooldownPeriod: 0,
      timeSinceLastClaim: 0
    },
    metadata: {
      accountCreatedAt: '',
      isFirstTimeUser: true,
      totalDaysSinceCreation: 0,
      cooldownHours: 24,
      cooldownMinutes: 1440,
      cooldownSeconds: 86400
    }
  });

  const [showTipsModal, setShowTipsModal] = useState(false);
  const [currentTipStep, setCurrentTipStep] = useState(0);
  const [hasSeenTips, setHasSeenTips] = useState(false);
  const [tipSteps] = useState<TipStep[]>([
    {
      step: 1,
      title: "Welcome to ENB Mining!",
      description: "This is your mining dashboard where you can claim daily rewards and upgrade your account.",
      icon: "🎯",
      targetElementId: "daily-claim-section"
    },
    {
      step: 2,
      title: "Daily Claims",
      description: "Claim your daily ENB rewards every 24 hours. The more consecutive days, the better rewards!",
      icon: "⏰",
      targetElementId: "daily-claim-section"
    },
    {
      step: 3,
      title: "Upgrade Your Account",
      description: "Upgrade to higher tiers for better daily rewards. You need consecutive days to unlock upgrades.",
      icon: "🚀",
      targetElementId: "upgrade-section"
    },
    {
      step: 4,
      title: "Invite Friends",
      description: "Share your invitation code to earn rewards and help others get started!",
      icon: "👥",
      targetElementId: "invitation-stats-section"
    }
  ]);

  const publicClient = useMemo(() => {
    return createPublicClient({ chain: base, transport: http() });
  }, []);

  // Basic functions
  const fetchClaimStatus = useCallback(async (): Promise<ClaimStatus | null> => {
    if (!address) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/api/daily-claim-status/${address}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('Error fetching claim status:', error);
      return null;
    }
  }, [address]);

  // Refresh mining activity data
  const refreshMiningActivity = useCallback(async () => {
    if (!address) return;
    
    try {
      // Dispatch custom event to trigger immediate refresh in all mining activity components
      window.dispatchEvent(new CustomEvent('refreshMiningActivity'));
      console.log('🔄 Mining activity refresh event dispatched');
    } catch (error) {
      console.error('Error refreshing mining activity:', error);
    }
  }, [address]);

  const updateClaimStatus = useCallback(async () => {
    const status = await fetchClaimStatus();
    if (status) setClaimStatus(status);
    
    // Also trigger mining activity refresh
    await refreshMiningActivity();
  }, [fetchClaimStatus, refreshMiningActivity]);

  const fetchEnbBalance = useCallback(async () => {
    if (!address) return;
    setEnbBalanceLoading(true);
    try {
      const balance = await publicClient.readContract({
        address: ENB_TOKEN_ADDRESS as `0x${string}`,
        abi: ENB_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`]
      }) as bigint;
      setEnbBalance(Number(balance) / Math.pow(10, 18));
      
      // Also trigger mining activity refresh
      await refreshMiningActivity();
    } catch {
      setEnbBalance(0);
    } finally {
      setEnbBalanceLoading(false);
    }
  }, [address, publicClient, refreshMiningActivity]);

  const refreshProfile = useCallback(async () => {
    if (!address) return;
    setProfileRefreshLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/profile/${address}`);
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        await updateClaimStatus();
        setProfileRefreshSuccess(true);
        setTimeout(() => setProfileRefreshSuccess(false), 3000);
        
        // Also trigger mining activity refresh
        await refreshMiningActivity();
      }
    } catch {
      console.error('Error refreshing profile');
    } finally {
      setProfileRefreshLoading(false);
    }
  }, [address, updateClaimStatus, refreshMiningActivity]);

  // Enhanced refresh function for after daily claims
  const refreshAfterDailyClaim = useCallback(async () => {
    if (!address) return;
    
    try {
      // Refresh profile data
      await refreshProfile();
      
      // Refresh claim status
      await updateClaimStatus();
      
      // Refresh ENB balance
      await fetchEnbBalance();
      
      // Trigger mining activity refresh
      await refreshMiningActivity();
      
      console.log('✅ All data refreshed after daily claim');
    } catch (error) {
      console.error('Error refreshing data after daily claim:', error);
    }
  }, [address, refreshProfile, updateClaimStatus, fetchEnbBalance, refreshMiningActivity]);

  const handleDailyClaim = async () => {
    if (!address) {
      alert('Please connect your wallet first');
      return;
    }

    setDailyClaimLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/relay/daily-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: address }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === 'DailyClaimOnCooldown') {
          throw new Error('Daily claim is still on cooldown. Please wait until your next claim is available.');
        } else if (data.error === 'ContractError') {
          throw new Error('Transaction failed. Please check if your account exists and try again.');
        } else {
          throw new Error(data.message || data.error || 'Daily claim failed');
        }
      }

      setShowDailyClaimModal(true);
      
      // Immediate refresh for better UX
      await refreshMiningActivity();
      
      await refreshAfterDailyClaim();
      
      // Delayed refresh to ensure backend synchronization
      setTimeout(async () => {
        await refreshMiningActivity();
      }, 3000); // Wait 3 seconds for backend processing
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Daily Claim failed. Please try again.');
    } finally {
      setDailyClaimLoading(false);
    }
  };

  const handleDailyClaimWarpcastShare = async () => {
    const getEnbAmount = (level: string) => {
      switch (level) {
        case 'Based': return 10;
        case 'Super Based': return 15;
        case 'Legendary': return 20;
        default: return 10;
      }
    };

    const enbAmount = getEnbAmount(profile?.membershipLevel || 'Based');
    
    try {
      await sdk.actions.composeCast({
        text: `I just claimed my daily ${enbAmount} $ENB rewards as a ${profile?.membershipLevel} member! Join me and start earning now! ${profile?.invitationCode}`,
        embeds: ["https://enb-crushers.vercel.app"]
      });
      
      // Also trigger mining activity refresh after sharing
      await refreshMiningActivity();
    } catch (error) {
      console.error('Error sharing daily claim:', error);
    }
  };

  const handleUpgradeWarpcastShare = async () => {
    try {
      await sdk.actions.composeCast({
        text: "I just upgraded my mining account to increase my daily earnings! Join me and start earning NOW!",
        embeds: ["https://enb-crushers.vercel.app"]
      });
      
      // Also trigger mining activity refresh after sharing
      await refreshMiningActivity();
    } catch (error) {
      console.error('Error sharing upgrade:', error);
    }
  };

  const handleInvitationCode = async () => {
    if (!profile?.invitationCode) return;
    
    try {
      await sdk.actions.composeCast({
        text: `Join me on ENB Mining! Use my invitation code: ${profile.invitationCode}\n\nMine daily rewards and upgrade your membership level. Start your journey today! 🚀\n\n#ENBMining #Web3 #Mining`,
        embeds: ["https://enb-crushers.vercel.app"]
      });
    } catch (error) {
      console.error('Error sharing invitation code:', error);
    }
    
    // Also trigger mining activity refresh
    await refreshMiningActivity();
  };

  const handleBuyENB = async () => {
    const url = "https://wallet.coinbase.com/post/0x942862cba4a0f04ebe119bafd494eba55bc7164f";
    await sdk.actions.openUrl(url);
  };

  const handleBooster = async () => {
    setShowBoosterModal(true);   
  };

  const handleInformation = async () => {
    setInformationModal(true);   
  };

  const handleUpgrade = async () => {
    if (!address || !profile) {
      alert('Please connect your wallet first');
      return;
    }

    const requiredDays = profile.membershipLevel === 'Based' ? 14 : 28;
    if (profile.consecutiveDays < requiredDays) {
      alert(`You need ${requiredDays} consecutive days to upgrade. Current: ${profile.consecutiveDays}`);
      return;
    }

    setUpgradeLoading(true);
    try {
      let targetLevel;
      switch (profile.membershipLevel) {
        case 'Based': targetLevel = 1; break;
        case 'Super Based': targetLevel = 2; break;
        default: alert('You are already at the highest level!'); return;
      }

      const res = await fetch(`${API_BASE_URL}/relay/upgrade-membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: address, targetLevel }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upgrade failed');
      }

      setShowUpgradeModal(true);
      await refreshProfile();
      
      // Also trigger mining activity refresh
      await refreshMiningActivity();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Upgrade error:', err);
      
      if (errorMessage.includes('insufficient funds') || errorMessage.includes('gas')) {
        setUpgradeError('Insufficient ETH balance to cover gas fees. Please add some ETH to your wallet and try again.');
      } else if (errorMessage.includes('user rejected') || errorMessage.includes('User rejected')) {
        setUpgradeError('Transaction was cancelled by user.');
      } else if (errorMessage.includes('execution reverted')) {
        setUpgradeError('Transaction failed. You may not have enough ENB tokens or the upgrade requirements are not met.');
      } else if (errorMessage.includes('InsufficientTokensForUpgrade')) {
        setUpgradeError('You do not have enough ENB tokens in your wallet to upgrade. You need 5,000 ENB for Super Based or 15,000 ENB for Legendary.');
      } else if (errorMessage.includes('InvalidMembershipLevel')) {
        setUpgradeError('Invalid membership level specified. Please try again.');
      } else if (errorMessage.includes('AlreadyAtMaxLevel')) {
        setUpgradeError('You are already at the maximum membership level.');
      } else if (errorMessage.includes('CannotSkipLevels')) {
        setUpgradeError('Cannot skip membership levels. Must upgrade sequentially.');
      } else {
        setUpgradeError(errorMessage);
      }
    } finally {
      setUpgradeLoading(false);
    }
  };

  const checkAccountStatus = useCallback(async () => {
    if (!address) {
      setError('No wallet connected');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(`${API_BASE_URL}/api/profile/${address}`);
      
      if (res.status === 404) {
        setProfile(null);
        setError('not_created');
        setLoading(false);
        return;
      }
      
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to fetch profile: ${res.status} ${errorText}`);
      }

      const userProfile: UserProfile = await res.json();
      
      if (!userProfile.isActivated) {
        setProfile(userProfile);
        setError('not_activated');
        setLoading(false);
        return;
      }

      setProfile(userProfile);
      await updateClaimStatus();
      
    } catch (err) {
      console.error('Error checking account status:', err);
      setError(`Failed to load account information: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [address, updateClaimStatus]);

  // Effects
  useEffect(() => {
    checkAccountStatus();
  }, [checkAccountStatus]);

  useEffect(() => {
    if (address) {
      fetchEnbBalance();
    }
  }, [address, fetchEnbBalance]);

  useEffect(() => {
    if (claimStatus.countdown.eligibilityTime && !claimStatus.canClaim) {
      const timer = setInterval(() => {
        setClaimStatus(prev => {
          const now = Date.now();
          const eligibilityTime = new Date(prev.countdown.eligibilityTime).getTime();
          const timeUntilEligibility = Math.max(0, eligibilityTime - now);
          
          if (timeUntilEligibility <= 0) {
            return {
              ...prev,
              canClaim: true,
              timeLeft: { hours: 0, minutes: 0, seconds: 0 },
              countdown: {
                ...prev.countdown,
                timeUntilEligibility: 0,
                progress: 100
              }
            };
          }
          
          const totalSeconds = Math.floor(timeUntilEligibility / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          
          const cooldownPeriod = prev.countdown.cooldownPeriod;
          const progress = Math.min(100, ((cooldownPeriod - timeUntilEligibility) / cooldownPeriod) * 100);
          
          return {
            ...prev,
            canClaim: false,
            timeLeft: { hours, minutes, seconds },
            countdown: {
              ...prev.countdown,
              timeUntilEligibility,
              progress,
              countdownComponents: { totalSeconds, hours, minutes, seconds }
            }
          };
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [claimStatus.countdown.eligibilityTime, claimStatus.countdown.cooldownPeriod, claimStatus.canClaim]);

  useEffect(() => {
    if (address) {
      updateClaimStatus();
      const syncInterval = setInterval(() => {
        updateClaimStatus();
      }, 30000);
      return () => clearInterval(syncInterval);
    }
  }, [address, updateClaimStatus]);

  // Periodic profile refresh to keep consecutive days data current
  useEffect(() => {
    if (address && profile) {
      const profileSyncInterval = setInterval(() => {
        refreshProfile();
      }, 60000); // Refresh profile every minute
      return () => clearInterval(profileSyncInterval);
    }
  }, [address, profile, refreshProfile]);

  // Tips logic
  const handleNextTip = () => {
    if (currentTipStep < tipSteps.length - 1) {
      setCurrentTipStep(currentTipStep + 1);
    }
  };

  const handlePreviousTip = () => {
    if (currentTipStep > 0) {
      setCurrentTipStep(currentTipStep - 1);
    }
  };

  const handleFinishTips = async () => {
    setShowTipsModal(false);
    setCurrentTipStep(0);
    setHasSeenTips(true);
    
    // Also trigger mining activity refresh
    await refreshMiningActivity();
  };

  const handleSkipTips = async () => {
    setShowTipsModal(false);
    setCurrentTipStep(0);
    setHasSeenTips(true);
    
    // Also trigger mining activity refresh
    await refreshMiningActivity();
  };

  const handleRestartTips = () => {
    setCurrentTipStep(0);
    setShowTipsModal(true);
    
    // Also trigger mining activity refresh
    refreshMiningActivity();
  };

  return {
    // State
    profile,
    loading,
    error,
    enbBalance,
    enbBalanceLoading,
    claimStatus,
    dailyClaimLoading,
    upgradeLoading,
    upgradeError,
    profileRefreshLoading,
    profileRefreshSuccess,
    showDailyClaimModal,
    showUpgradeModal,
    showBoosterModal,
    showInformationModal,
    showTipsModal,
    currentTipStep,
    hasSeenTips,
    tipSteps,
    
    // Actions
    handleDailyClaim,
    handleDailyClaimWarpcastShare,
    handleUpgradeWarpcastShare,
    handleInvitationCode,
    handleBuyENB,
    handleBooster,
    handleInformation,
    handleUpgrade,
    refreshProfile,
    fetchEnbBalance,
    refreshAfterDailyClaim,
    refreshMiningActivity,
    
    // Tips actions
    handleNextTip,
    handlePreviousTip,
    handleFinishTips,
    handleSkipTips,
    handleRestartTips,
    
    // Modal actions
    setShowDailyClaimModal,
    setShowUpgradeModal,
    setShowBoosterModal,
    setInformationModal,
    setShowTipsModal,
    setUpgradeError,
  };
};
