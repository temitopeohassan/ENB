'use client';

export const Stats: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-xl font-bold">Mining Statistics</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Your Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Mined</span>
              <span className="font-semibold">Coming Soon</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Mining Streak</span>
              <span className="font-semibold">Coming Soon</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Daily Average</span>
              <span className="font-semibold">Coming Soon</span>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Network Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Miners</span>
              <span className="font-semibold">Coming Soon</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Network Hashrate</span>
              <span className="font-semibold">Coming Soon</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total Supply</span>
              <span className="font-semibold">Coming Soon</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Stats Coming Soon</h3>
        <p className="text-blue-800 dark:text-blue-200">
          Detailed mining statistics and analytics are under development. Check back soon for comprehensive insights into your mining performance!
        </p>
      </div>
    </div>
  );
};

