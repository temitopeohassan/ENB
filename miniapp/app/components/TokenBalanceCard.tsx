'use client';

interface TokenBalanceCardProps {
  enbBalance: number;
  enbBalanceLoading: boolean;
  onInformationClick: () => void;
}

export const TokenBalanceCard: React.FC<TokenBalanceCardProps> = ({
  enbBalance,
  enbBalanceLoading,
  onInformationClick
}) => {
  return (
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
