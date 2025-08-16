'use client';

import { Button } from "./Button";
import { Icon } from "./Icon";

interface SuccessModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onDismiss: () => void;
  onShare?: () => void;
  shareButtonText?: string;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  title,
  message,
  onDismiss,
  onShare,
  shareButtonText
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
            {title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {message}
          </p>
        </div>
        <div className="flex justify-center space-x-4">
          <Button onClick={onDismiss}>
            Dismiss
          </Button>
          {onShare && shareButtonText && (
            <Button onClick={onShare} variant="outline">
              {shareButtonText}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
