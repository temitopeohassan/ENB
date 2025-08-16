'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config';

export interface MiningActivity {
  walletAddress: string;
  consecutiveDays: number;
  currentStreak: number;
  longestStreak: number;
  totalClaims: number;
  lastClaimDate: string | null;
  canClaimToday: boolean;
  nextClaimTime: string | null;
  timeLeft: {
    hours: number;
    minutes: number;
    seconds: number;
  };
  timeUntilNextClaim: number;
  nextMilestone: {
    level: string;
    required: number;
    current: number;
    remaining: number;
  } | null;
  progressToMilestone: number;
  membershipLevel: string;
  accountCreatedAt: string | null;
  isActivated: boolean;
  recentClaims: Array<{
    claimedAt: string;
    txHash: string;
  }>;
}

export const useMiningActivity = (walletAddress: string | undefined) => {
  const [miningActivity, setMiningActivity] = useState<MiningActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const refreshTriggerRef = useRef<(() => void) | null>(null);

  const fetchMiningActivity = useCallback(async (isRefresh = false) => {
    if (!walletAddress) {
      setError('Wallet address is required');
      setLoading(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await fetch(`${API_BASE_URL}/api/mining-activity/${walletAddress}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Account not found. Please create an account first.');
        }
        throw new Error(`Failed to fetch mining activity: ${response.status}`);
      }

      const data = await response.json();
      setMiningActivity(data);

      // Set success state for refresh operations
      if (isRefresh) {
        setRefreshSuccess(true);
        setTimeout(() => setRefreshSuccess(false), 3000); // Clear success after 3 seconds
      }

    } catch (err) {
      console.error('Error fetching mining activity:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch mining activity');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [walletAddress]);

  // Listen for custom refresh events
  useEffect(() => {
    const handleRefreshEvent = () => {
      console.log('🔄 Mining activity refresh triggered via custom event');
      fetchMiningActivity(true);
    };

    // Create a custom event listener for immediate refreshes
    window.addEventListener('refreshMiningActivity', handleRefreshEvent);
    
    // Also expose the refresh function via a ref for direct calls
    refreshTriggerRef.current = () => {
      console.log('🔄 Mining activity refresh triggered via ref');
      fetchMiningActivity(true);
    };

    return () => {
      window.removeEventListener('refreshMiningActivity', handleRefreshEvent);
      refreshTriggerRef.current = null;
    };
  }, [fetchMiningActivity]);

  useEffect(() => {
    fetchMiningActivity();
  }, [fetchMiningActivity]);

  // Periodic refresh to keep mining activity data current (reduced interval for more responsiveness)
  useEffect(() => {
    if (walletAddress && miningActivity) {
      const miningSyncInterval = setInterval(() => {
        fetchMiningActivity(true);
      }, 15000); // Refresh every 15 seconds instead of 30 for more responsiveness
      return () => clearInterval(miningSyncInterval);
    }
  }, [walletAddress, miningActivity, fetchMiningActivity]);

  const refresh = useCallback(() => {
    fetchMiningActivity(true);
  }, [fetchMiningActivity]);

  // Function to trigger immediate refresh from external components
  const triggerImmediateRefresh = useCallback(() => {
    if (refreshTriggerRef.current) {
      refreshTriggerRef.current();
    } else {
      // Fallback to direct refresh if ref is not available
      fetchMiningActivity(true);
    }
  }, [fetchMiningActivity]);

  return {
    miningActivity,
    loading,
    error,
    refreshing,
    refreshSuccess,
    refresh,
    triggerImmediateRefresh
  };
};
