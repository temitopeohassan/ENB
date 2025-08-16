'use client';

import { useState, useEffect } from 'react';
import { useMiningActivity } from '../hooks/useMiningActivity';

interface UserProfile {
  walletAddress: string;
  consecutiveDays: number;
  lastDailyClaimTime?: string | null;
  joinDate?: string;
}

interface MiningActivityCardProps {
  profile: UserProfile;
  profileRefreshLoading?: boolean;
  profileRefreshSuccess?: boolean;
}

export const MiningActivityCard: React.FC<MiningActivityCardProps> = ({ 
  profile, 
  profileRefreshLoading = false,
  profileRefreshSuccess = false
}) => {
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  // Use the new mining activity hook for accurate data
                const {
                miningActivity,
                loading: miningLoading,
                error: miningError,
                refreshing: miningRefreshing,
                refreshSuccess: miningRefreshSuccess,
                refresh: refreshMining
              } = useMiningActivity(profile.walletAddress);

  // Update refresh timestamp when profile or mining activity changes
  useEffect(() => {
    setLastRefresh(new Date());
  }, [profile.consecutiveDays, profile.lastDailyClaimTime, miningActivity?.consecutiveDays]);

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getStreakColor = (days: number) => {
    if (days >= 28) return 'text-purple-600'; // Legendary
    if (days >= 14) return 'text-blue-600';  // Super Based
    if (days >= 7) return 'text-green-600';  // Good streak
    return 'text-orange-600';                 // Building streak
  };

  const getStreakEmoji = (days: number) => {
    if (days >= 28) return '🔥';
    if (days >= 14) return '⚡';
    if (days >= 7) return '💪';
    if (days >= 3) return '🚀';
    return '🌱';
  };

  // Use mining activity data if available, fallback to profile data
  const consecutiveDays = miningActivity?.consecutiveDays ?? profile.consecutiveDays;
  const lastClaimDate = miningActivity?.lastClaimDate ?? profile.lastDailyClaimTime;
  const canClaimToday = miningActivity?.canClaimToday ?? false;
  const timeLeft = miningActivity?.timeLeft ?? { hours: 0, minutes: 0, seconds: 0 };
  const nextMilestone = miningActivity?.nextMilestone;
  const progressToMilestone = miningActivity?.progressToMilestone ?? 0;

  if (miningLoading && !miningActivity) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (miningError && !miningActivity) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border">
        <div className="text-center py-8">
          <div className="text-red-500 mb-2">⚠️</div>
          <div className="text-sm text-gray-600 mb-4">{miningError}</div>
          <button
            onClick={refreshMining}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Mining Activity</h2>
        <div className="flex items-center space-x-2">
          {(profileRefreshLoading || miningRefreshing) && (
            <div className="flex items-center space-x-1">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              <span className="text-xs text-blue-600">Refreshing...</span>
            </div>
          )}
          {(profileRefreshSuccess || miningRefreshSuccess) && (
            <div className="text-green-500 text-xs">✓ Updated</div>
          )}
          <button
            onClick={refreshMining}
            disabled={miningRefreshing}
            className={`text-xs transition-colors ${
              miningRefreshing 
                ? 'text-gray-400 cursor-not-allowed' 
                : 'text-blue-600 hover:text-blue-800'
            }`}
            title="Refresh mining activity"
          >
            🔄
          </button>
          <div className="text-xs text-gray-400">
            Updated: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        {/* Consecutive Days with Visual Enhancement */}
        <div className="text-center">
          <div className="text-3xl font-bold mb-2">
            <span className={getStreakColor(consecutiveDays)}>
              {consecutiveDays}
            </span>
            <span className="text-2xl ml-2">{getStreakEmoji(consecutiveDays)}</span>
          </div>
          <div className="text-sm font-medium text-gray-600 mb-2">Consecutive Days</div>
          
          {/* Streak Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className="bg-gradient-to-r from-orange-400 via-green-400 to-purple-600 h-2 rounded-full transition-all duration-500"
              style={{ 
                width: `${Math.min((consecutiveDays / 28) * 100, 100)}%` 
              }}
            ></div>
          </div>
          
          {/* Streak Milestones */}
          <div className="text-xs text-gray-500">
            {consecutiveDays < 14 && (
              <span>Next milestone: {14 - consecutiveDays} days to Super Based</span>
            )}
            {consecutiveDays >= 14 && consecutiveDays < 28 && (
              <span>Next milestone: {28 - consecutiveDays} days to Legendary</span>
            )}
            {consecutiveDays >= 28 && (
              <span className="text-purple-600 font-medium">🎉 Legendary status achieved!</span>
            )}
          </div>
        </div>

        {/* Next Milestone Progress (if available) */}
        {nextMilestone && (
          <div className="bg-purple-50 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-700">
                Progress to {nextMilestone.level}
              </span>
              <span className="text-sm font-medium text-purple-600">
                {nextMilestone.current}/{nextMilestone.required} days
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div
                className="bg-gradient-to-r from-purple-400 to-purple-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressToMilestone}%` }}
              ></div>
            </div>
            <div className="text-xs text-purple-600">
              {nextMilestone.remaining > 0 ? (
                <span>{nextMilestone.remaining} more consecutive days needed</span>
              ) : (
                <span className="font-medium">✅ Requirements met! Ready to upgrade</span>
              )}
            </div>
          </div>
        )}

        {/* Claim Status */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <label className="text-sm font-medium text-gray-600 block mb-1">Claim Status</label>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-800 font-medium">
                {canClaimToday ? 'Ready to claim!' : 'Next claim available'}
              </p>
              {lastClaimDate && (
                <p className="text-xs text-gray-600 mt-1">
                  Last claim: {formatDate(lastClaimDate)}
                </p>
              )}
            </div>
            {!canClaimToday && timeLeft && (
              <div className="text-right">
                <div className="text-sm font-medium text-blue-600">
                  {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                </div>
                <div className="text-xs text-gray-500">Time remaining</div>
              </div>
            )}
          </div>
        </div>

        {/* Join Date */}
        {profile.joinDate && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <label className="text-sm font-medium text-gray-600 block mb-1">Join Date</label>
            <p className="text-gray-800">{formatDate(profile.joinDate)}</p>
            <div className="text-xs text-gray-500 mt-1">
              {consecutiveDays > 0 
                ? `You&apos;ve been active for ${consecutiveDays} consecutive days!`
                : 'Start your streak today!'
              }
            </div>
          </div>
        )}

        {/* Recent Claims */}
        {miningActivity?.recentClaims && miningActivity.recentClaims.length > 0 && (
          <div className="bg-green-50 p-3 rounded-lg">
            <label className="text-sm font-medium text-gray-600 block mb-2">Recent Claims</label>
            <div className="space-y-1">
              {miningActivity.recentClaims.slice(-3).map((claim, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700">
                    {new Date(claim.claimedAt).toLocaleDateString()}
                  </span>
                  <span className="text-green-600 font-mono text-xs">
                    {claim.txHash.slice(0, 6)}...{claim.txHash.slice(-4)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
