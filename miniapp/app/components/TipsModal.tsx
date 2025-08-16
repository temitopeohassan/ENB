'use client';

import { Icon } from "./Icon";

interface TipStep {
  step: number;
  title: string;
  description: string;
  icon: string;
  targetElementId: string;
}

interface TipsModalProps {
  isOpen: boolean;
  currentTipStep: number;
  tipSteps: TipStep[];
  onNextTip: () => void;
  onPreviousTip: () => void;
  onFinishTips: () => void;
  onSkipTips: () => void;
}

export const TipsModal: React.FC<TipsModalProps> = ({
  isOpen,
  currentTipStep,
  tipSteps,
  onNextTip,
  onPreviousTip,
  onFinishTips,
  onSkipTips
}) => {
  if (!isOpen) return null;

  const currentStep = tipSteps[currentTipStep];
  const isLastStep = currentTipStep === tipSteps.length - 1;
  const isFirstStep = currentTipStep === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 max-w-md w-full mx-4 relative">
        {/* Progress indicator */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Step {currentTipStep + 1} of {tipSteps.length}
            </span>
            <button
              onClick={onSkipTips}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Skip Tour
            </button>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentTipStep + 1) / tipSteps.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
            <Icon name="check" size="lg" className="text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            {currentStep.title}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            {currentStep.description}
          </p>
        </div>

        <div className="flex justify-between space-x-3">
          <button
            onClick={onPreviousTip}
            disabled={isFirstStep}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isFirstStep 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Previous
          </button>
          
          {isLastStep ? (
            <button
              onClick={onFinishTips}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Finish Tour
            </button>
          ) : (
            <button
              onClick={onNextTip}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
