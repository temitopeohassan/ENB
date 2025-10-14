'use client';

import { useFrame } from '../farcaster-provider';

interface UserProfile {
  walletAddress: string;
  membershipLevel: string;
  invitationCode: string | null;
  totalUsersActivated?: number;
  isActivated: boolean;
}

interface UserProfileCardProps {
  profile: UserProfile;
  onRefreshProfile: () => void;
  profileRefreshLoading: boolean;
  profileRefreshSuccess: boolean;
  onInvitationCodeShare: () => void;
}

export const UserProfileCard: React.FC<UserProfileCardProps> = ({
  profile,
  onRefreshProfile,
  profileRefreshLoading,
  profileRefreshSuccess,
  onInvitationCodeShare
}) => {
  const { context } = useFrame();

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

  return (
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
                onClick={onRefreshProfile}
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
        {profile.totalUsersActivated !== undefined && (
          <div>
            <label className="text-sm font-medium text-gray-600">Total Users Activated</label>
            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Users Activated:</span>
                <span className="font-semibold text-blue-600">{profile.totalUsersActivated}</span>
              </div>
            </div>
          </div>
        )}
        <div>
          <div className="space-y-3">
            <button
              onClick={onInvitationCodeShare}
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
  );
};
