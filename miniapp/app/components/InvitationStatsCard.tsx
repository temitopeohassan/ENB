'use client';

import { useState, useEffect } from 'react';

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

interface StatsCardProps {
  walletAddress: string;
}

interface DailyInviteUsage {
  count: number;
  date: string;
}

interface BackendInviteUsage {
  totalUses: number;
  maxUses: number;
  invitationCode: string;
  inviterWallet: string;
  isInviterActivated: boolean;
}

export const InvitationStatsCard: React.FC<StatsCardProps> = ({ walletAddress }) => {
  const [loading, setLoading] = useState(true);
  const [dailyUsage, setDailyUsage] = useState<DailyInviteUsage>({ count: 0, date: '' });
  const [backendUsage, setBackendUsage] = useState<BackendInviteUsage | null>(null);
  const [maxDailyUses] = useState(5);

  // Get today's date in YYYY-MM-DD format for UTC comparison
  const getTodayUTC = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // Check if we need to reset the daily count
  const checkAndResetDailyCount = () => {
    const today = getTodayUTC();
    const stored = localStorage.getItem(`dailyInviteUsage_${walletAddress}`);
    
    if (stored) {
      const parsed: DailyInviteUsage = JSON.parse(stored);
      
      // If it's a new day, reset the count
      if (parsed.date !== today) {
        const newUsage = { count: 0, date: today };
        localStorage.setItem(`dailyInviteUsage_${walletAddress}`, JSON.stringify(newUsage));
        return newUsage;
      }
      
      return parsed;
    } else {
      // First time, initialize with today's date
      const newUsage = { count: 0, date: today };
      localStorage.setItem(`dailyInviteUsage_${walletAddress}`, JSON.stringify(newUsage));
      return newUsage;
    }
  };

  // Fetch invite usage data from backend
  const fetchBackendUsage = async () => {
    try {
      // First, get the user's profile to find their invitation code
      const profileResponse = await fetch(`/api/profile/${walletAddress}`);
      
      if (!profileResponse.ok) {
        if (profileResponse.status === 404) {
          throw new Error('Profile not found. Please create an account first.');
        }
        throw new Error(`Failed to fetch profile: ${profileResponse.status}`);
      }

      const profileData = await profileResponse.json();
      
      if (!profileData.invitationCode) {
        throw new Error('No invitation code found for this wallet. Please contact support.');
      }

      // Then fetch the invitation usage data using the invitation code
      const usageResponse = await fetch(`/api/invitation-usage/${profileData.invitationCode}`);
      
      if (!usageResponse.ok) {
        if (usageResponse.status === 404) {
          throw new Error('Invitation code not found. Please contact support.');
        }
        throw new Error(`Failed to fetch invitation usage: ${usageResponse.status}`);
      }

      const usageData = await usageResponse.json();
      
      setBackendUsage({
        totalUses: usageData.totalUses,
        maxUses: usageData.maxUses,
        invitationCode: usageData.invitationCode,
        inviterWallet: usageData.inviterWallet,
        isInviterActivated: usageData.isInviterActivated
      });

    } catch (err) {
      console.error('Error fetching backend usage:', err);
      // Don't set error state, just log it
    }
  };

  useEffect(() => {
    if (walletAddress) {
      const usage = checkAndResetDailyCount();
      setDailyUsage(usage);
      fetchBackendUsage();
      setLoading(false);
    }
  }, [walletAddress]);

  // Check for date change every minute to handle UTC reset
  useEffect(() => {
    const interval = setInterval(() => {
      const usage = checkAndResetDailyCount();
      setDailyUsage(usage);
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [walletAddress]);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Daily Invite Usage</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const isMaxReached = dailyUsage.count >= maxDailyUses;
  const progressPercentage = (dailyUsage.count / maxDailyUses) * 100;

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border">
      <style>{fadeInStyle}</style>
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Daily Invite Usage</h2>
        <p className="text-sm text-gray-600 mt-1">Wallet: {walletAddress}</p>
      </div>
      
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {dailyUsage.count}/{maxDailyUses}
          </div>
          <div className="text-sm text-gray-600">Invite Uses Today</div>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600 mb-2">Daily Progress</div>
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <div className="text-xs text-gray-500">
            {dailyUsage.count} of {maxDailyUses} daily invites used
          </div>
          {isMaxReached && (
            <div className="text-xs text-orange-600 font-medium mt-2">
              Daily limit reached. Resets at 00:00 UTC.
            </div>
          )}
        </div>

        {/* Backend Data Display */}
        {backendUsage && (
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">Overall Invitation Stats</div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Total Uses:</span>
                <span className="font-medium">{backendUsage.totalUses}/{backendUsage.maxUses}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Invitation Code:</span>
                <span className="font-mono font-medium">{backendUsage.invitationCode}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${backendUsage.isInviterActivated ? 'text-green-600' : 'text-orange-600'}`}>
                  {backendUsage.isInviterActivated ? 'Activated' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="text-center text-xs text-gray-400">
          Resets daily at 00:00 UTC
        </div>
      </div>
    </div>
  );
};
