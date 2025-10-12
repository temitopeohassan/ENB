'use client';

import { useBalance, useAccount } from "wagmi";
import { type Address } from "viem";
import { ENB_TOKEN_ADDRESS } from '../constants/enbMiniAppAbi';

interface TokenBalanceCardProps {
  onInformationClick: () => void;
}

export const TokenBalanceCard: React.FC<TokenBalanceCardProps> = ({
  onInformationClick
}) => {
  // Wagmi hook to get the address and check if the user is connected
  // Works with both Farcaster and AppKit configs
  const { address, isConnected } = useAccount();

  // Wagmi hook to fetch the ENB token balance
  const { data: balanceData, isLoading: enbBalanceLoading } = useBalance({
    address: address as Address,
    token: ENB_TOKEN_ADDRESS as Address,
  });

  // Extract balance value
  const enbBalance = balanceData?.value 
    ? Number(balanceData.value) / Math.pow(10, balanceData.decimals) 
    : 0;

  if (!isConnected) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md border">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Token Balance</h2>
        <p className="text-gray-600">Please connect your wallet to view balance</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Token Balance</h2>
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-gray-600">
            {balanceData?.symbol || 'ENB'} Balance
          </label>
          {enbBalanceLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-gray-600">Loading...</span>
            </div>
          ) : (
            <p className="text-lg font-semibold text-blue-600">
              {enbBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {balanceData?.symbol || 'ENB'}
            </p>
          )}
        </div>
        <div>
          <button
            onClick={onInformationClick}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
          >
            How To Earn
          </button>
        </div>
      </div>
    </div>
  );
};
