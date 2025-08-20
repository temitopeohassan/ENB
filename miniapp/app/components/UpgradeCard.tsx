'use client';

import { useState, useEffect } from 'react';
import { useMiningActivity } from '../hooks/useMiningActivity';

interface UserProfile {
  walletAddress: string;
  membershipLevel: string;
  consecutiveDays: number;
}

interface UpgradeCardProps {
  profile: UserProfile;
  upgradeLoading: boolean;
  upgradeError: string | null;
  onUpgradeAction: () => void;
  onBuyENBAction: () => void;
  onClearErrorAction: () => void;
  profileRefreshLoading?: boolean;
  profileRefreshSuccess?: boolean;
}

export const UpgradeCard: React.FC<UpgradeCardProps> = ({
  profile,
  upgradeLoading,
  upgradeError,
  onUpgradeAction,
  onBuyENBAction,
  onClearErrorAction,
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
  }, [profile.consecutiveDays, profile.membershipLevel, miningActivity?.consecutiveDays]);

  // Use mining activity data if available, fallback to profile data
  const consecutiveDays = miningActivity?.consecutiveDays ?? profile.consecutiveDays;
  const membershipLevel = miningActivity?.membershipLevel ?? profile.membershipLevel;
  const nextMilestone = miningActivity?.nextMilestone;
  const progressToMilestone = miningActivity?.progressToMilestone ?? 0;

  const getUpgradeRequirements = () => {
    if (membershipLevel === 'Based') {
      return {
        current: consecutiveDays,
        required: 14,
        nextLevel: 'Super Based',
        color: 'blue'
      };
    } else if (membershipLevel === 'Super Based') {
      return {
        current: consecutiveDays,
        required: 28,
        nextLevel: 'Legendary',
        color: 'purple'
      };
    }
    return null;
  };

  const requirements = getUpgradeRequirements();
  const canUpgrade = requirements && consecutiveDays >= requirements.required;

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
    <div id="upgrade-section" className="bg-white p-6 rounded-lg shadow-md border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Upgrade</h2>
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
        {/* Helpful Note */}
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
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
                • Based → Super Based: 14 consecutive days<br/>
                • Super Based → Legendary: 28 consecutive days
              </p>
            </div>
          </div>
        </div>



        {/* Next Milestone Progress (if available from mining activity) */}
        {nextMilestone && (
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-purple-700">
                Progress to {nextMilestone.level}
              </span>
              <span className="text-sm font-medium text-purple-600">
                {nextMilestone.current}/{nextMilestone.required} days
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
              <div
                className="bg-gradient-to-r from-purple-400 to-purple-600 h-3 rounded-full transition-all duration-500"
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
        
        {/* Upgrade Error Display */}
        {upgradeError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
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
                  onClick={onClearErrorAction}
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
        
        {/* Upgrade Button */}
        {requirements ? (
          <button
            disabled={upgradeLoading || !canUpgrade}
            onClick={onUpgradeAction}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
              canUpgrade && !upgradeLoading
                ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 shadow-lg'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            } disabled:opacity-60`}
          >
            {upgradeLoading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Upgrading...
              </div>
            ) : !canUpgrade ? (
              `Need ${requirements.required} consecutive days (${consecutiveDays}/${requirements.required})`
            ) : (
              `Upgrade to ${requirements.nextLevel}`
            )}
          </button>
        ) : (
          <div className="text-center py-4">
            <div className="text-lg font-semibold text-purple-600 mb-2">🎉</div>
            <div className="text-sm text-gray-600">You&apos;ve reached the maximum level!</div>
          </div>
        )}
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <button
          onClick={onBuyENBAction}
          className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60 transition-colors"
        >
          Buy $ENB
        </button>
      </div>
    </div>
  );
};
