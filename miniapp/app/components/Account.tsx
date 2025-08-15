'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { ENB_TOKEN_ABI, ENB_TOKEN_ADDRESS } from '../constants/enbMiniAppAbi';
import { API_BASE_URL } from '../config';
import {
  createPublicClient,
  http
} from 'viem';
import { base } from 'viem/chains';
import { Button } from "./Button";
import { Icon } from "./Icon";
import { sdk } from '@farcaster/frame-sdk'
import { useFrame } from '../farcaster-provider'

interface UserProfile {
  walletAddress: string;
  membershipLevel: 'Based' | 'Super Based' | 'Legendary' | string;
  invitationCode: string | null;
  invitationUsage?: {
    totalUses: number;
    maxUses: number;
    remainingUses: number;
  } | null;
  enbBalance: number;
  lastDailyClaimTime?: string | null;
  consecutiveDays: number;
  totalEarned: number;
  joinDate?: string;
  isActivated: boolean;
}

// Enhanced ClaimStatus interface to match the new endpoint
interface ClaimStatus {
  canClaim: boolean;
  timeLeft: {
    hours: number;
    minutes: number;
    seconds: number;
  };
  nextClaimTime: string | null;
  lastClaimTime: string | null;
  countdown: {
    timeUntilEligibility: number;
    eligibilityTime: string;
    countdownComponents: {
      totalSeconds: number;
      hours: number;
      minutes: number;
      seconds: number;
    };
    progress: number;
    cooldownPeriod: number;
    timeSinceLastClaim: number;
  };
  metadata: {
    accountCreatedAt: string;
    isFirstTimeUser: boolean;
    totalDaysSinceCreation: number;
    cooldownHours: number;
    cooldownMinutes: number;
    cooldownSeconds: number;
  };
}

interface TipStep {
  step: number;
  title: string;
  description: string;
  icon: string;
  targetElementId: string;
}

interface AccountProps {
  setActiveTabAction: (tab: string) => void;
}

export const Account: React.FC<AccountProps> = ({ setActiveTabAction }) => {
  const { address } = useAccount();
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
  
  // Enhanced countdown state with all the new data
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

const { context } = useFrame()  
  
  // Tips state
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

  // Fetch claim status from the enhanced endpoint
  const fetchClaimStatus = useCallback(async (): Promise<ClaimStatus | null> => {
    if (!address) return null;
    
    console.log('🔍 Fetching enhanced claim status from backend...');
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/daily-claim-status/${address}`);
      
      if (!response.ok) {
        console.log('⚠️ Could not fetch claim status from backend');
        return null;
      }
      
      const backendClaimStatus = await response.json();
      console.log('✅ Enhanced claim status from backend:', backendClaimStatus);
      
      // The backend now returns the exact structure we need
      return backendClaimStatus;
    } catch (error) {
      console.error('❌ Error fetching claim status:', error);
      return null;
    }
  }, [address]);

  // Update claim status from backend
  const updateClaimStatus = useCallback(async () => {
    const status = await fetchClaimStatus();
    if (status) {
      setClaimStatus(status);
      console.log('✅ Enhanced claim status updated:', status);
    }
  }, [fetchClaimStatus]);

  // Enhanced countdown timer using the new countdown data
  useEffect(() => {
    // Only run countdown when we have valid eligibility time and user can't claim yet
    if (claimStatus.countdown.eligibilityTime && !claimStatus.canClaim) {
      console.log('⏰ Starting countdown timer with eligibility time:', claimStatus.countdown.eligibilityTime);
      
      const timer = setInterval(() => {
        setClaimStatus(prev => {
          // Calculate the current time until eligibility
          const now = Date.now();
          const eligibilityTime = new Date(prev.countdown.eligibilityTime).getTime();
          const timeUntilEligibility = Math.max(0, eligibilityTime - now);
          
          console.log('⏰ Countdown update:', { 
            now: new Date(now).toISOString(), 
            eligibilityTime: new Date(eligibilityTime).toISOString(),
            timeUntilEligibility,
            canClaim: prev.canClaim
          });
          
          // If time is up, user can claim
          if (timeUntilEligibility <= 0) {
            console.log('✅ Countdown finished - user can now claim!');
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
          
          // Calculate time components
          const totalSeconds = Math.floor(timeUntilEligibility / 1000);
          const hours = Math.floor(totalSeconds / 3600);
          const minutes = Math.floor((totalSeconds % 3600) / 60);
          const seconds = totalSeconds % 60;
          
          // Calculate progress percentage
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

      return () => {
        console.log('⏰ Clearing countdown timer');
        clearInterval(timer);
      };
    }
  }, [claimStatus.countdown.eligibilityTime, claimStatus.countdown.cooldownPeriod, claimStatus.canClaim]);

  // Initialize claim status when component mounts
  useEffect(() => {
    if (address) {
      console.log('🚀 Initializing claim status for address:', address);
      updateClaimStatus();
    }
  }, [address, updateClaimStatus]);

  // Sync with backend every 30 seconds to ensure accuracy
  useEffect(() => {
    if (!address) return;

    // Set up periodic sync
    const syncInterval = setInterval(() => {
      console.log('🔄 Syncing with backend...');
      updateClaimStatus();
    }, 30000); // Every 30 seconds

    return () => clearInterval(syncInterval);
  }, [address, updateClaimStatus]);

  const getMembershipLevelColor = (level: string) => {
    switch (level) {
      case 'Based': return 'text-blue-600';
      case 'Super Based': return 'text-purple-600';
      case 'Legendary': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  const formatWalletAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  // Fetch tips status from backend
  const fetchTipsStatus = useCallback(async () => {
    if (!address) return false;
    
    console.log('🔍 Fetching tips status from backend...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/has-seen-tips/${address}`);
      
      if (!response.ok) {
        console.log('⚠️ Could not fetch tips status, using fallback logic');
        return false; // Default to showing tips if check fails
      }
      
      const data = await response.json();
      console.log('✅ Tips status from backend:', data);
      
      return data.hasSeenTips || false;
    } catch (error) {
      console.error('❌ Error fetching tips status:', error);
      return false; // Default to showing tips if check fails
    }
  }, [address]);

  // Mark tips as seen in backend
  const markTipsAsSeen = useCallback(async () => {
    if (!address) return false;
    
    console.log('✅ Marking tips as seen in backend...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/mark-tips-seen/${address}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        console.log('⚠️ Could not mark tips as seen, using fallback logic');
        // Fall back to localStorage if backend fails
        try {
          localStorage.setItem('enb-tips-seen', 'true');
        } catch {
          // Ignore localStorage errors
        }
        return false;
      }
      
      const data = await response.json();
      console.log('✅ Tips marked as seen in backend:', data);
      
      // Also update localStorage as backup
      try {
        localStorage.setItem('enb-tips-seen', 'true');
      } catch {
        // Ignore localStorage errors
      }
      
      return data.success || false;
    } catch (error) {
      console.error('❌ Error marking tips as seen:', error);
      // Fall back to localStorage if backend fails
      try {
        localStorage.setItem('enb-tips-seen', 'true');
      } catch {
        // Ignore localStorage errors
      }
      return false;
    }
  }, [address]);

  // Check if user has seen tips (with fallback to localStorage)
  const checkIfUserHasSeenTips = useCallback(async () => {
    if (!address) return false;
    
    try {
      // Try backend first
      const backendStatus = await fetchTipsStatus();
      if (backendStatus !== null) {
        return backendStatus;
      }
      
      // Fall back to localStorage
      const seen = localStorage.getItem('enb-tips-seen');
      return seen === 'true';
    } catch {
      // Fall back to localStorage if all else fails
      try {
        const seen = localStorage.getItem('enb-tips-seen');
        return seen === 'true';
      } catch {
        return false;
      }
    }
  }, [address, fetchTipsStatus]);

  // Function to scroll to specific elements
  const scrollToElement = (elementId: string) => {
    setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center',
          inline: 'center'
        });
      }
    }, 100);
  };

  // Functions to handle the tips modal
  const handleNextTip = () => {
    if (currentTipStep < tipSteps.length - 1) {
      setCurrentTipStep(currentTipStep + 1);
      scrollToElement(tipSteps[currentTipStep + 1].targetElementId);
    }
  };

  const handlePreviousTip = () => {
    if (currentTipStep > 0) {
      setCurrentTipStep(currentTipStep - 1);
      scrollToElement(tipSteps[currentTipStep - 1].targetElementId);
    }
  };

  const handleFinishTips = async () => {
    console.log('🎯 Finishing tips tour...');
    
    // Mark tips as seen in backend
    const success = await markTipsAsSeen();
    
    if (success) {
      console.log('✅ Tips marked as seen successfully');
    } else {
      console.log('⚠️ Tips marked as seen with fallback');
    }
    
    // Update local state
    setShowTipsModal(false);
    setCurrentTipStep(0);
    setHasSeenTips(true);
  };

  const handleSkipTips = async () => {
    console.log('⏭️ Skipping tips tour...');
    
    // Mark tips as seen in backend
    const success = await markTipsAsSeen();
    
    if (success) {
      console.log('✅ Tips marked as seen successfully');
    } else {
      console.log('⚠️ Tips marked as seen with fallback');
    }
    
    // Update local state
    setShowTipsModal(false);
    setCurrentTipStep(0);
    setHasSeenTips(true);
  };

  // Add a function to restart tips (optional - you can add a button for this)
  const handleRestartTips = () => {
    console.log('🔄 Restarting tips tour...');
    setCurrentTipStep(0);
    setShowTipsModal(true);
    scrollToElement(tipSteps[0].targetElementId);
  };

  



  // Sync with backend every 30 seconds to ensure accuracy
  useEffect(() => {
    if (!address) return;

    // Initial fetch
    updateClaimStatus();

    // Set up periodic sync
    const syncInterval = setInterval(() => {
      console.log('🔄 Syncing with backend...');
      updateClaimStatus();
    }, 30000); // Every 30 seconds

    return () => clearInterval(syncInterval);
  }, [address, updateClaimStatus]);

  // Refresh profile data when component becomes visible (e.g., after navigation)
  useEffect(() => {
    if (address && profile) {
      console.log('🔄 Refreshing profile data to ensure invite usage is up to date...');
      refreshProfile();
    }
  }, [address, profile?.walletAddress]); // Refresh when address changes or when profile is loaded

  const checkAccountStatus = useCallback(async () => {
    if (!address) {
      setError('No wallet connected');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching profile from:', `${API_BASE_URL}/api/profile/${address}`);
      
      const res = await fetch(`${API_BASE_URL}/api/profile/${address}`);
      
      console.log('Response status:', res.status);
      
      if (res.status === 404) {
        // Account doesn't exist, show create message
        console.log('Account not found, redirecting to create');
        setProfile(null);
        setError('not_created');
        setLoading(false);
        return;
      }
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('API error response:', errorText);
        throw new Error(`Failed to fetch profile: ${res.status} ${errorText}`);
      }

      const userProfile: UserProfile = await res.json();
      console.log('Profile data received:', userProfile);
      
      // Check if account is not activated
      if (!userProfile.isActivated) {
        // Account exists but not activated, show activation message
        console.log('Account not activated, redirecting to activate');
        setProfile(userProfile);
        setError('not_activated');
        setLoading(false);
        return;
      }

      // Account exists and is activated, show profile
      console.log('Account activated, showing profile');
      setProfile(userProfile);
      
      // Fetch initial claim status
      await updateClaimStatus();
      
    } catch (err) {
      console.error('Error checking account status:', err);
      setError(`Failed to load account information: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [address, updateClaimStatus]);

  const publicClient = useMemo(() => {
    return createPublicClient({ chain: base, transport: http() });
  }, []);

  const fetchEnbBalance = useCallback(async () => {
    console.log('💰 Fetching ENB balance...');
    
    if (!address) {
      console.log('❌ No address provided for balance fetch');
      return;
    }

    setEnbBalanceLoading(true);
    try {
      console.log('📤 Reading contract balance...');
      const balance = await publicClient.readContract({
        address: ENB_TOKEN_ADDRESS as `0x${string}`,
        abi: ENB_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`]
      }) as bigint;

      const balanceInEnb = Number(balance) / Math.pow(10, 18);
      console.log('✅ ENB balance fetched:', { rawBalance: balance.toString(), balanceInEnb });
      setEnbBalance(balanceInEnb);
    } catch (err) {
      console.error('❌ Error fetching ENB balance:', err);
      setEnbBalance(0);
    } finally {
      setEnbBalanceLoading(false);
      console.log('🏁 ENB balance fetch finished');
    }
  }, [address, publicClient]);

  const refreshProfile = async () => {
    if (!address) return;
    
    setProfileRefreshLoading(true);
    setProfileRefreshSuccess(false);
    try {
      console.log('🔄 Refreshing profile data...');
      const res = await fetch(`${API_BASE_URL}/api/profile/${address}`);
      if (res.ok) {
        const updated = await res.json();
        console.log('✅ Profile refreshed:', updated);
        setProfile(updated);
        // Also refresh claim status when profile is refreshed
        await updateClaimStatus();
        console.log('✅ All profile data refreshed successfully');
        setProfileRefreshSuccess(true);
        // Hide success message after 3 seconds
        setTimeout(() => setProfileRefreshSuccess(false), 3000);
      } else {
        console.error('❌ Failed to refresh profile:', res.status, res.statusText);
      }
    } catch (err) {
      console.error('❌ Error refreshing profile:', err);
    } finally {
      setProfileRefreshLoading(false);
    }
  };

  const handleDailyClaim = async () => {
    if (!address) {
      console.log('❌ No wallet address available');
      alert('Please connect your wallet first');
      return;
    }

    console.log('🚀 Starting daily claim process...');
    console.log('📋 Current state:', { 
      address, 
      canClaim: claimStatus.canClaim,
      timeLeft: claimStatus.timeLeft
    });

    setDailyClaimLoading(true);
    try {
      console.log('📡 Making request to backend relayer...');
      
      const res = await fetch(`${API_BASE_URL}/relay/daily-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: address }),
      });

      console.log('📥 Response received:', { 
        status: res.status, 
        statusText: res.statusText,
        ok: res.ok
      });

      const data = await res.json();
      console.log('📄 Response data:', data);

      if (!res.ok) {
        console.log('❌ Backend returned error status');
        if (data.error === 'DailyClaimOnCooldown') {
          throw new Error('Daily claim is still on cooldown. Please wait until your next claim is available.');
        } else if (data.error === 'ContractError') {
          throw new Error('Transaction failed. Please check if your account exists and try again.');
        } else {
          throw new Error(data.message || data.error || 'Daily claim failed');
        }
      }

      console.log('✅ Daily claim successful:', data);
      
      // Show the success modal
      setShowDailyClaimModal(true);
      
      // Immediately update claim status from backend after successful claim
      console.log('🔄 Refreshing claim status after successful claim...');
      await updateClaimStatus();
      
      // Force an immediate countdown restart by updating the state
      setClaimStatus(prev => ({
        ...prev,
        canClaim: false // Reset to false to trigger countdown restart
      }));
      
      // Add a small delay and refresh again to ensure backend sync
      setTimeout(async () => {
        console.log('🔄 Delayed refresh to ensure backend sync...');
        await updateClaimStatus();
      }, 2000);
      
      // Refresh other data
      await fetchEnbBalance();
      await refreshProfile();
      
      console.log('✅ All data refreshed after claim');
    } catch (err) {
      console.error('❌ Daily claim error:', err);
      alert(err instanceof Error ? err.message : 'Daily Claim failed. Please try again.');
    } finally {
      console.log('🏁 Setting loading to false');
      setDailyClaimLoading(false);
    }
  };

  const handleDailyClaimWarpcastShare = async () => {
    // Calculate ENB amount based on membership level
    const getEnbAmount = (level: string) => {
      switch (level) {
        case 'Based': return 10;
        case 'Super Based': return 15;
        case 'Legendary': return 20;
        default: return 10;
      }
    };

    const enbAmount = getEnbAmount(profile?.membershipLevel || 'Based');
    
    await sdk.actions.composeCast({
      text: `I just claimed my daily ${enbAmount} $ENB rewards as a ${profile?.membershipLevel} member! Join me and start earning now! ${profile?.invitationCode}`,
      embeds: ["https://enb-crushers.vercel.app"]
    });
  };

  const handleUpgradeWarpcastShare = async () => {
    await sdk.actions.composeCast({
      text: "I just upgraded my mining account to increase my daily earnings! Join me and start earning NOW!",
      embeds: ["https://enb-crushers.vercel.app"]
    });
  };

  const handleInvitationCode = async () => {
    await sdk.actions.composeCast({
      text: `Use my invitation code to start earning $ENB and start earning now! ${profile?.invitationCode}`,
      embeds: ["https://enb-crushers.vercel.app"]
    });
  };

  const url= "https://wallet.coinbase.com/post/0x942862cba4a0f04ebe119bafd494eba55bc7164f";

  const handleBuyENB = async () => {
    await sdk.actions.openUrl(url)
  };

  const handleBooster = async () => {
    setShowBoosterModal(true);   
  };

  const handleInformation = async () => {
    setInformationModal(true);   
  };

  const handleUpgrade = async () => {
    console.log('🚀 Starting upgrade process...');
    
    if (!address || !profile) {
      console.log('❌ Cannot upgrade - missing address or profile');
      return;
    }

    // Check consecutive days requirement
    const requiredDays = profile.membershipLevel === 'Based' ? 14 : 28;
    console.log('📊 Upgrade requirements:', { currentLevel: profile.membershipLevel, requiredDays, currentDays: profile.consecutiveDays });
    
    if (profile.consecutiveDays < requiredDays) {
      console.log('❌ Insufficient consecutive days for upgrade');
      setUpgradeError(`You need ${requiredDays} consecutive days of daily claims to upgrade. You currently have ${profile.consecutiveDays} days.`);
      return;
    }

    let targetLevel: number;
    switch (profile.membershipLevel) {
      case 'Based': targetLevel = 1; break; // SuperBased = 1
      case 'Super Based': targetLevel = 2; break; // Legendary = 2
      default:
        console.log('❌ Already at highest level');
        alert('You are already at the highest level!');
        return;
    }

    console.log('✅ Upgrade requirements met, target level:', targetLevel);
    setUpgradeLoading(true);
    setUpgradeError(null);
    
    try {
      console.log('🔄 Using relayer for upgrade...');
      
      const res = await fetch(`${API_BASE_URL}/relay/upgrade-membership`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user: address, 
          targetLevel: targetLevel 
        }),
      });

      console.log('📥 Relayer response status:', res.status);
      
      const data = await res.json();
      console.log('📋 Relayer response data:', data);
      
      if (!res.ok) {
        console.error('❌ Relayer request failed:', data);
        throw new Error(data.error || 'Upgrade failed');
      }

      console.log('✅ Upgrade successful via relayer');
      setShowUpgradeModal(true);
      await refreshProfile();
      await fetchEnbBalance();
    } catch (err) {
      console.error('❌ Upgrade failed:', err);
      
      // Handle specific error types
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.log('🔍 Error analysis:', errorMessage);
      
      if (errorMessage.includes('insufficient funds') || errorMessage.includes('gas')) {
        setUpgradeError('Insufficient ETH balance to cover gas fees. Please add some ETH to your wallet and try again.');
      } else if (errorMessage.includes('user rejected') || errorMessage.includes('User rejected')) {
        setUpgradeError('Transaction was cancelled by user.');
      } else if (errorMessage.includes('execution reverted')) {
        setUpgradeError('Transaction failed. You may not have enough ENB tokens or the upgrade requirements are not met.');
      } else if (errorMessage.includes('InsufficientTokensForUpgrade')) {
        setUpgradeError('You do not have enough ENB tokens in your wallet to upgrade. You need 5,000 ENB for Super Based or 15,000 ENB for Legendary.');
      } else if (errorMessage.includes('InvalidMembershipLevel')) {
        setUpgradeError('Invalid upgrade request. You may already be at the highest level.');
      } else {
        setUpgradeError(`Upgrade failed: ${errorMessage}`);
      }
    } finally {
      setUpgradeLoading(false);
      console.log('🏁 Upgrade process finished');
    }
  };

  // Check account status when component mounts or address changes
  useEffect(() => {
    checkAccountStatus();
  }, [checkAccountStatus]);

  // Fetch ENB balance when address changes
  useEffect(() => {
    if (address) {
      fetchEnbBalance();
    }
  }, [address, fetchEnbBalance]);

  // Add this useEffect to show tips on first load
  useEffect(() => {
    const initializeTips = async () => {
      if (profile && profile.isActivated && address) {
        console.log('🎯 Initializing tips for activated profile...');
        
        try {
          const hasSeenTipsBefore = await checkIfUserHasSeenTips();
          console.log('📋 Tips status:', { hasSeenTipsBefore });
          
          if (!hasSeenTipsBefore) {
            console.log('🆕 User has not seen tips, showing tips modal');
            setShowTipsModal(true);
            setHasSeenTips(false);
          } else {
            console.log('✅ User has seen tips, hiding tips modal');
            setHasSeenTips(true);
            setShowTipsModal(false);
          }
        } catch (error) {
          console.error('❌ Error initializing tips:', error);
          // Default to showing tips if there's an error
          setShowTipsModal(true);
          setHasSeenTips(false);
        }
      }
    };

    initializeTips();
  }, [profile, address, checkIfUserHasSeenTips]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking account status...</p>
        </div>
      </div>
    );
  }

  // Error/Special states
  if (error === 'not_created') {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center max-w-md">
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-6 py-4 rounded-lg mb-6">
            <h2 className="text-lg font-semibold mb-2">Account Not Found</h2>
            <p>Your account has not been created. Please create an account to get started.</p>
          </div>
          <button
            onClick={() => setActiveTabAction('create')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Create Account
          </button>
        </div>
      </div>
    );
  }

  if (error === 'not_activated') {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center max-w-md">
          <div className="bg-orange-100 border border-orange-400 text-orange-700 px-6 py-4 rounded-lg mb-6">
            <h2 className="text-lg font-semibold mb-2">Account Not Activated</h2>
            <p>This account has not been activated. Please activate your account to continue.</p>
          </div>
          <button
            onClick={() => setActiveTabAction('create')}
            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
          >
            Activate Account
          </button>
        </div>
      </div>
    );
  }

  if (error && error !== 'not_created' && error !== 'not_activated') {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <p>{error}</p>
          </div>
          <button
            onClick={checkAccountStatus}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // This should not render if profile is null due to redirects above
  if (!profile) {
    return null;
  }

  // Tips Modal Component
  const TipsModal = () => {
    const currentStep = tipSteps[currentTipStep];
    const isLastStep = currentTipStep === tipSteps.length - 1;
    const isFirstStep = currentTipStep === 0;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 relative">
          {/* Progress indicator */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Step {currentTipStep + 1} of {tipSteps.length}
              </span>
              <button
                onClick={handleSkipTips}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                Skip Tour
              </button>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentTipStep + 1) / tipSteps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="text-center mb-6">
            <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
              <Icon name="check" size="lg" className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {currentStep.title}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              {currentStep.description}
            </p>
          </div>

          <div className="flex justify-between space-x-3">
            <button
              onClick={handlePreviousTip}
              disabled={isFirstStep}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isFirstStep 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Previous
            </button>
            
            {isLastStep ? (
              <button
                onClick={handleFinishTips}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Finish Tour
              </button>
            ) : (
              <button
                onClick={handleNextTip}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-semibold mb-2 text-gray-800">Account Profile</h1>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Basic Info */}
        <div id="basic-info-section" className="bg-white p-6 rounded-lg shadow-md border">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Basic Information</h2>
          <div className="flex flex-row space-x-4 justify-start items-start">
            {context?.user ? (
              <>
                {context?.user?.pfpUrl && (
                  <img
                    src={context?.user?.pfpUrl}
                    className="w-14 h-14 rounded-full"
                    alt="User Profile"
                    width={56}
                    height={56}
                  />
                )}
              </>
            ) : (
              <p className="text-sm text-left">User context not available</p>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Wallet Address</label>
              <p className="text-gray-800 font-mono">{formatWalletAddress(profile.walletAddress)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Mining Level</label>
              <p className={`font-semibold ${getMembershipLevelColor(profile.membershipLevel)}`}>
                {profile.membershipLevel}
              </p>
            </div>
            {profile.invitationCode && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium text-gray-600">Activation Code</label>
                  <button
                    onClick={refreshProfile}
                    disabled={profileRefreshLoading}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Refresh invitation code data"
                  >
                    {profileRefreshLoading ? '⏳' : '🔄'} Refresh
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <p className="text-gray-800 font-mono">{profile.invitationCode}</p>
                  {profileRefreshLoading && (
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                  )}
                  {profileRefreshSuccess && (
                    <div className="text-green-500 text-sm">✓</div>
                  )}
                </div>
              </div>
            )}
            {profile.invitationUsage && (
              <div>
                <label className="text-sm font-medium text-gray-600">Invitation Usage</label>
                <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Total Users Activated:</span>
                    <span className="font-semibold text-blue-600">{profile.invitationUsage.totalUses}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Remaining Uses:</span>
                    <span className="font-semibold text-green-600">{profile.invitationUsage.remainingUses}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Max Uses:</span>
                    <span className="font-semibold text-gray-800">{profile.invitationUsage.maxUses}</span>
                  </div>
                </div>
              </div>
            )}
            <div>
              <div className="space-y-3">
                <button
                  onClick={handleInvitationCode}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
                >
                  Share Invitation Code
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              <p className={`font-semibold ${profile.isActivated ? 'text-green-600' : 'text-orange-600'}`}>
                {profile.isActivated ? 'Activated' : 'Not Activated'}
              </p>
            </div>
          </div>
        </div>

        {/* Token Info */}
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Token Balance</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">ENB Balance</label>
              {enbBalanceLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-gray-600">Loading...</span>
                </div>
              ) : (
              <p className="text-lg font-semibold text-blue-600">
                  {enbBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ENB
              </p>
              )}
            </div>
            <div>
            <button
              onClick={handleInformation}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
            >
              How To Earn
            </button>
            </div>
          </div>
        </div>

        {/* Activity Info */}
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Mining Activity</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Consecutive Days</label>
              <p className="text-lg font-semibold text-purple-600">
                {profile.consecutiveDays} days
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Last Daily Claim</label>
              <p className="text-gray-800">
                {profile.lastDailyClaimTime ? formatDate(profile.lastDailyClaimTime) : 'Never'}
              </p>
            </div>
            {profile.joinDate && (
              <div>
                <label className="text-sm font-medium text-gray-600">Join Date</label>
                <p className="text-gray-800">{formatDate(profile.joinDate)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Invitation Statistics */}
        {profile.invitationUsage && (
          <div id="invitation-stats-section" className="bg-white p-6 rounded-lg shadow-md border">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Invitation Statistics</h2>
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-2">{profile.invitationUsage.totalUses}</div>
                <div className="text-sm text-gray-600">Total Users</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Invite Rewards Progress</div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(profile.invitationUsage.totalUses / profile.invitationUsage.maxUses) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {profile.invitationUsage.totalUses} of {profile.invitationUsage.maxUses} uses
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Daily Claim Actions - ENHANCED VERSION */}
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
              onClick={handleDailyClaim}
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

        {/* Boosters*/}
        <div className="bg-white p-6 rounded-lg shadow-md border">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Boosters</h2>
          <div className="space-y-3">
            <button
              onClick={handleBooster}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
            >
              Boosters
            </button>
          </div>
        </div>

        {/* Upgrade */}
        <div id="upgrade-section" className="bg-white p-6 rounded-lg shadow-md border">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Upgrade</h2>
          <div className="space-y-3">
            {/* Helpful Note */}
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">Upgrade Requirements</p>
                  <p className="text-sm mt-1">
                    • You need ETH in your wallet to pay for gas fees<br/>
                    • It will cost you ENB tokens to upgrade: 30,000 ENB for Super Based, 60,000 ENB for Legendary<br/>
                    • Based → Super Based: {profile.membershipLevel === 'Based' ? `${profile.consecutiveDays}/14` : '14/14'} consecutive days<br/>
                    • Super Based → Legendary: {profile.membershipLevel === 'Super Based' ? `${profile.consecutiveDays}/28` : '28/28'} consecutive days
                  </p>
                </div>
              </div>
            </div>
            
            {/* Upgrade Error Display */}
            {upgradeError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium">{upgradeError}</p>
                  </div>
                  <div className="ml-auto pl-3">
                    <button
                      onClick={() => setUpgradeError(null)}
                      className="inline-flex text-red-400 hover:text-red-600"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {(() => {
              const requiredDays = profile.membershipLevel === 'Based' ? 14 : profile.membershipLevel === 'Super Based' ? 28 : 0;
              const canUpgrade = profile.membershipLevel !== 'Legendary' && profile.consecutiveDays >= requiredDays;
              
              return (
                <button
                  disabled={upgradeLoading || !canUpgrade}
                  onClick={handleUpgrade}
                  className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                    canUpgrade && !upgradeLoading
                      ? 'bg-purple-600 text-white hover:bg-purple-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  } disabled:opacity-60`}
                >
                  {upgradeLoading 
                    ? 'Upgrading...' 
                    : !canUpgrade 
                    ? `Need ${requiredDays} consecutive days (${profile.consecutiveDays}/${requiredDays})`
                    : 'Upgrade Mining Level'
                  }
                </button>
              );
            })()}
          </div>
          <br />
          <div className="space-y-3">
            <button
              onClick={handleBuyENB}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60"
            >
              Buy $ENB
            </button>
          </div>
        </div>
      </div>

      {/* Daily Claim Modal */}
      {showDailyClaimModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <Icon name="check" size="lg" className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Daily Claim Successful
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                You have successfully claimed your daily rewards. Come back tomorrow to claim again!
              </p>
            </div>
            <div className="flex justify-center space-x-4">
              <Button onClick={() => setShowDailyClaimModal(false)}>
                Dismiss
              </Button>
              <Button onClick={handleDailyClaimWarpcastShare} variant="outline">
                Share on Farcaster
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <Icon name="check" size="lg" className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Account Upgrade Successful
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your account has been upgraded successfully. Your daily claim yield has increased!
              </p>
            </div>
            <div className="flex justify-center space-x-4">
              <Button onClick={() => setShowUpgradeModal(false)}>
                Dismiss
              </Button>
              <Button onClick={handleUpgradeWarpcastShare} variant="outline">
                Share on Farcaster
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Booster Modal */}
      {showBoosterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <Icon name="check" size="lg" className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Get Boosters (Coming Soon)
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Boosters allow you to reduce the time between daily claims. Watch this space!
              </p>
            </div>
            <div className="flex justify-center space-x-4">
              <Button onClick={() => setShowBoosterModal(false)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Level Information Modal */}
      {showInformationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
                <Icon name="check" size="lg" className="text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                How To Earn
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                On the Base Layer there are 3 levels to earn and each level has the daily earning
              </p>
              <ul className="text-left space-y-2 mt-3">
                <li>• <strong>Based</strong> - On this level (the first level) you earn 10 ENB a day</li>
                <li>• <strong>Super Based</strong> - As a Super Based member you earn 15 ENB. To upgrade to Super Based you need:
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>- 30,000 ENB in your wallet</li>
                    <li>- 14 consecutive days of daily claims</li>
                  </ul>
                </li>
                <li>• <strong>Legendary</strong> - The Legendary is the highest level allowing you to earn 20 ENB everyday. To upgrade to Legendary you need:
                  <ul className="ml-4 mt-1 space-y-1">
                    <li>- 60,000 ENB in your wallet</li>
                    <li>- 28 consecutive days of daily claims</li>
                  </ul>
                </li>
              </ul>
            </div>
            <div className="flex justify-center space-x-4">
              <Button onClick={() => setInformationModal(false)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* Tips Modal */}
      {showTipsModal && <TipsModal />}

      {/* Help button to restart tips */}
      {hasSeenTips && (
        <button
          onClick={handleRestartTips}
          className="fixed bottom-4 right-4 bg-blue-600 text-white p-3 rounded-full shadow-lg hover:bg-blue-700 z-40"
          title="Restart Tips Tour"
        >
          <Icon name="star" size="sm" />
        </button>
      )}

    </div>
  );
};