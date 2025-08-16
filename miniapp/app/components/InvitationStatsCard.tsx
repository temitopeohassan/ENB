'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '../config';

// CSS for animations
const fadeInStyle = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out;
  }
`;

interface InvitationUsage {
  totalUses: number;
  maxUses: number;
  remainingUses: number;
  invitationCode: string;
  inviterWallet: string;
  isInviterActivated: boolean;
}

interface InvitationStatsCardProps {
  walletAddress: string;
}

export const InvitationStatsCard: React.FC<InvitationStatsCardProps> = ({ walletAddress }) => {
  const [invitationUsage, setInvitationUsage] = useState<InvitationUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchInvitationUsage = useCallback(async (isRefresh = false) => {
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

      // First, get the user's profile to find their invitation code
      const profileResponse = await fetch(`${API_BASE_URL}/api/profile/${walletAddress}`);
      
      if (!profileResponse.ok) {
        if (profileResponse.status === 404) {
          throw new Error('Profile not found. Please create an account first.');
        }
        throw new Error(`Failed to fetch profile: ${profileResponse.status}`);
      }

      const profileData = await profileResponse.json();
      
      if (!profileData.invitationCode) {
        setError('No invitation code found for this wallet. Please contact support.');
        if (isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
        return;
      }

      // Then fetch the invitation usage data using the invitation code
      const usageResponse = await fetch(`${API_BASE_URL}/api/invitation-usage/${profileData.invitationCode}`);
      
      if (!usageResponse.ok) {
        if (usageResponse.status === 404) {
          throw new Error('Invitation code not found. Please contact support.');
        }
        throw new Error(`Failed to fetch invitation usage: ${usageResponse.status}`);
      }

      const usageData = await usageResponse.json();
      
      setInvitationUsage({
        totalUses: usageData.totalUses,
        maxUses: usageData.maxUses,
        remainingUses: usageData.remainingUses,
        invitationCode: usageData.invitationCode,
        inviterWallet: usageData.inviterWallet,
        isInviterActivated: usageData.isInviterActivated
      });

      // Update last updated timestamp
      setLastUpdated(new Date());

      // Show success message for refresh
      if (isRefresh) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2000);
      }

    } catch (err) {
      console.error('Error fetching invitation usage:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invitation usage');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchInvitationUsage();
  }, [walletAddress, fetchInvitationUsage]);

  const handleRefresh = () => {
    fetchInvitationUsage(true);
  };

  const handleCopyCode = async () => {
    if (invitationUsage?.invitationCode) {
      try {
        await navigator.clipboard.writeText(invitationUsage.invitationCode);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (err) {
        console.error('Failed to copy invitation code:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = invitationUsage.invitationCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }
    }
  };

  if (loading) {
    return (
      <div id="invitation-stats-section" className="bg-white p-6 rounded-lg shadow-md border">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Invitation Statistics</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div id="invitation-stats-section" className="bg-white p-6 rounded-lg shadow-md border">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Invitation Statistics</h2>
        <div className="text-center py-4">
          <div className="text-red-500 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (!invitationUsage) {
    return (
      <div id="invitation-stats-section" className="bg-white p-6 rounded-lg shadow-md border">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Invitation Statistics</h2>
        <div className="text-center py-4">
          <div className="text-gray-500 text-sm">No invitation data available</div>
        </div>
      </div>
    );
  }

  return (
    <div id="invitation-stats-section" className="bg-white p-6 rounded-lg shadow-md border">
      <style>{fadeInStyle}</style>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Invitation Statistics</h2>
        <div className="flex items-center space-x-2">
          {showSuccess && (
            <div className="text-green-600 text-sm font-medium animate-fade-in">
              ✓ Updated
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh invitation data"
          >
            <svg
              className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600 mb-2">
            {refreshing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                Updating...
              </div>
            ) : (
              invitationUsage.totalUses
            )}
          </div>
          <div className="text-sm text-gray-600">Total Users</div>
        </div>
        
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Invite Rewards Progress</div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(invitationUsage.totalUses / invitationUsage.maxUses) * 100}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {invitationUsage.totalUses} of {invitationUsage.maxUses} uses
          </div>
          {invitationUsage.totalUses >= invitationUsage.maxUses && (
            <div className="text-xs text-green-600 font-medium mt-1">
              🎉 Maximum uses reached! You&apos;ve earned all available rewards.
            </div>
          )}
        </div>

        <div className="text-center">
          <div className="text-lg font-semibold text-green-600 mb-1">{invitationUsage.remainingUses}</div>
          <div className="text-sm text-gray-600">Remaining Uses</div>
          {invitationUsage.remainingUses === 0 && (
            <div className="text-xs text-orange-500 mt-1">
              No more uses available
            </div>
          )}
        </div>

        {invitationUsage.invitationCode && (
          <div className="bg-gray-50 p-3 rounded-lg text-center">
            <div className="text-xs text-gray-500 mb-1">Your Invitation Code</div>
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className="font-mono text-sm font-semibold text-gray-800 bg-white px-2 py-1 rounded border">
                {invitationUsage.invitationCode}
              </div>
              <button
                onClick={handleCopyCode}
                className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Copy invitation code"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            {copySuccess && (
              <div className="text-green-600 text-xs font-medium">✓ Copied to clipboard!</div>
            )}
          </div>
        )}

        {lastUpdated && (
          <div className="text-center text-xs text-gray-400">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Airdrop Information */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-3 rounded-lg border border-purple-200">
        <div className="text-sm font-medium text-purple-800 mb-2">🎁 Airdrop Rewards</div>
        <div className="text-xs text-purple-600 mb-2">
          Invite {invitationUsage.maxUses} users to trigger an airdrop reward!
        </div>
        <div className="w-full bg-purple-200 rounded-full h-2 mb-2">
          <div 
            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.min((invitationUsage.totalUses / invitationUsage.maxUses) * 100, 100)}%` }}
          ></div>
        </div>
        <div className="text-xs text-purple-500">
          {invitationUsage.totalUses >= invitationUsage.maxUses 
            ? "🎉 Airdrop threshold reached! Check your wallet for rewards."
            : `${invitationUsage.maxUses - invitationUsage.totalUses} more invites needed for airdrop`
          }
        </div>
      </div>
    </div>
  );
};
