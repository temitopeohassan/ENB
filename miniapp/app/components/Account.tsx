'use client';

import { Icon } from "./Icon";
import { UserProfileCard } from "./UserProfileCard";
import { TokenBalanceCard } from "./TokenBalanceCard";
import { MiningActivityCard } from "./MiningActivityCard";
import { InvitationStatsCard } from "./InvitationStatsCard";
import { DailyClaimCard } from "./DailyClaimCard";
import { BoosterCard } from "./BoosterCard";
import { UpgradeCard } from "./UpgradeCard";
import { TipsModal } from "./TipsModal";
import { SuccessModal } from "./SuccessModal";
import { InformationModal } from "./InformationModal";
import { BoosterModal } from "./BoosterModal";
import { useAccountLogic } from "../hooks/useAccountLogic";

interface AccountProps {
  setActiveTabAction: (tab: string) => void;
}

export const Account: React.FC<AccountProps> = ({ setActiveTabAction }) => {
  const {
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
    setUpgradeError,
  } = useAccountLogic();

  const handleRefreshAll = async () => {
    try {
      await refreshProfile();
      await refreshMiningActivity();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

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
            onClick={() => window.location.reload()}
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold text-gray-800">Account Profile</h1>
        <button
          onClick={handleRefreshAll}
          disabled={profileRefreshLoading}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
          title="Refresh all data"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Basic Info */}
        <UserProfileCard
          profile={profile}
          onRefreshProfile={refreshProfile}
          profileRefreshLoading={profileRefreshLoading}
          profileRefreshSuccess={profileRefreshSuccess}
          onInvitationCodeShare={handleInvitationCode}
        />

        {/* Daily Claim Actions */}
        <DailyClaimCard
          claimStatus={claimStatus}
          profile={profile}
          address={profile.walletAddress}
          dailyClaimLoading={dailyClaimLoading}
          onDailyClaim={handleDailyClaim}
          onRefreshMining={refreshMiningActivity}
        />

        {/* Token Info */}
        <TokenBalanceCard
          enbBalance={enbBalance}
          enbBalanceLoading={enbBalanceLoading}
          onInformationClick={handleInformation}
        />

                    {/* Activity Info */}
            <MiningActivityCard
              profile={{
                ...profile,
                walletAddress: profile.walletAddress
              }}
              profileRefreshLoading={profileRefreshLoading}
              profileRefreshSuccess={profileRefreshSuccess}
            />

        {/* Invitation Statistics */}
        {profile.invitationCode && (
          <InvitationStatsCard walletAddress={profile.walletAddress} />
        )}

        {/* Boosters */}
        <BoosterCard onBoosterClick={handleBooster} />

                    {/* Upgrade */}
            <UpgradeCard
              profile={{
                ...profile,
                walletAddress: profile.walletAddress
              }}
              upgradeLoading={upgradeLoading}
              upgradeError={upgradeError}
              onUpgradeAction={handleUpgrade}
              onBuyENBAction={handleBuyENB}
              onClearErrorAction={() => setUpgradeError(null)}
              profileRefreshLoading={profileRefreshLoading}
              profileRefreshSuccess={profileRefreshSuccess}
            />
      </div>

      {/* Daily Claim Modal */}
      <SuccessModal
        isOpen={showDailyClaimModal}
        title="Daily Claim Successful"
        message="You have successfully claimed your daily rewards. Come back tomorrow to claim again!"
        onDismiss={() => setShowDailyClaimModal(false)}
        onShare={handleDailyClaimWarpcastShare}
        shareButtonText="Share on Farcaster"
      />

      {/* Upgrade Modal */}
      <SuccessModal
        isOpen={showUpgradeModal}
        title="Account Upgrade Successful"
        message="Your account has been upgraded successfully. Your daily claim yield has increased!"
        onDismiss={() => setShowUpgradeModal(false)}
        onShare={handleUpgradeWarpcastShare}
        shareButtonText="Share on Farcaster"
      />

      {/* Booster Modal */}
      <BoosterModal
        isOpen={showBoosterModal}
        onDismiss={() => setShowBoosterModal(false)}
      />

      {/* Level Information Modal */}
      <InformationModal
        isOpen={showInformationModal}
        onDismiss={() => setInformationModal(false)}
      />

      {/* Tips Modal */}
      <TipsModal
        isOpen={showTipsModal}
        currentTipStep={currentTipStep}
        tipSteps={tipSteps}
        onNextTip={handleNextTip}
        onPreviousTip={handlePreviousTip}
        onFinishTips={handleFinishTips}
        onSkipTips={handleSkipTips}
      />

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