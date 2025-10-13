'use client';

export const Leaderboard: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold">Leaderboard</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-purple-600 to-blue-600">
          <h3 className="text-lg font-semibold text-white">Top Miners</h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            {/* Placeholder leaderboard entries */}
            {[1, 2, 3, 4, 5].map((rank) => (
              <div 
                key={rank} 
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                    rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                    rank === 2 ? 'bg-gray-300 text-gray-900' :
                    rank === 3 ? 'bg-orange-400 text-orange-900' :
                    'bg-gray-200 text-gray-700'
                  }`}>
                    {rank}
                  </div>
                  <div>
                    <div className="font-medium">Coming Soon</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Miner #{rank}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">---</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">ENB Mined</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
        <h3 className="font-medium text-purple-900 dark:text-purple-100 mb-2">Leaderboard Coming Soon</h3>
        <p className="text-purple-800 dark:text-purple-200">
          Compete with other miners and climb the ranks! The leaderboard feature is under development and will be available soon.
        </p>
      </div>
    </div>
  );
};

