'use client';

import { Button } from "./Button";
import { Icon } from "./Icon";

interface InformationModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

export const InformationModal: React.FC<InformationModalProps> = ({
  isOpen,
  onDismiss
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
            <Icon name="check" size="lg" className="text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            How To Earn
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            On the Base Layer there are 3 levels to earn and each level has the daily earning
          </p>
          <ul className="text-left space-y-2 mt-3">
            <li>• <strong>Based</strong> - On this level (the first level) you earn 10 ENB a day</li>
            <li>• <strong>Super Based</strong> - As a Super Based member you earn 15 ENB. To upgrade to Super Based you need:
              <ul className="ml-4 mt-1 space-y-1">
                <li>- 30,000 ENB in your wallet</li>
                <li>- 14 consecutive days of daily claims</li>
              </ul>
            </li>
            <li>• <strong>Legendary</strong> - The Legendary is the highest level allowing you to earn 20 ENB everyday. To upgrade to Legendary you need:
              <ul className="ml-4 mt-1 space-y-1">
                <li>- 60,000 ENB in your wallet</li>
                <li>- 28 consecutive days of daily claims</li>
              </ul>
            </li>
          </ul>
        </div>
        <div className="flex justify-center space-x-4">
          <Button onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
};
