export interface UserProfile {
  walletAddress: string;
  membershipLevel: 'Based' | 'Super Based' | 'Legendary' | string;
  invitationCode: string | null;
  invitationUsage?: {
    totalUses: number;
    maxUses: number;
    remainingUses: number;
  } | null;
  enbBalance: number;
  lastDailyClaimTime?: string | null;
  consecutiveDays: number;
  totalEarned: number;
  joinDate?: string;
  isActivated: boolean;
}

export interface ClaimStatus {
  canClaim: boolean;
  timeLeft: {
    hours: number;
    minutes: number;
    seconds: number;
  };
  nextClaimTime: string | null;
  lastClaimTime: string | null;
  countdown: {
    timeUntilEligibility: number;
    eligibilityTime: string;
    countdownComponents: {
      totalSeconds: number;
      hours: number;
      minutes: number;
      seconds: number;
    };
    progress: number;
    cooldownPeriod: number;
    timeSinceLastClaim: number;
  };
  metadata: {
    accountCreatedAt: string;
    isFirstTimeUser: boolean;
    totalDaysSinceCreation: number;
    cooldownHours: number;
    cooldownMinutes: number;
    cooldownSeconds: number;
  };
}

export interface TipStep {
  step: number;
  title: string;
  description: string;
  icon: string;
  targetElementId: string;
}
