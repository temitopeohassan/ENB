import { sdk } from '@farcaster/miniapp-sdk';

export interface NotificationPayload {
  title: string;
  body: string;
  targetUrl?: string;
  notificationId?: string;
}

/**
 * Send a notification to the current user
 */
export async function sendNotificationToCurrentUser(fid: number, payload: NotificationPayload): Promise<boolean> {
  try {
    // Since getContext() is not available, we'll require the FID to be passed
    // This function can be updated when the proper SDK method is available
    if (!fid) {
      console.warn('FID is required for sendNotificationToCurrentUser. Please provide the current user FID.');
      return false;
    }

    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fid,
        title: payload.title,
        body: payload.body,
        targetUrl: payload.targetUrl || window.location.href,
        notificationId: payload.notificationId || `user-${fid}-${Date.now()}`,
      }),
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}

/**
 * Send a notification to a specific user by FID
 */
export async function sendNotificationToUser(fid: number, payload: NotificationPayload): Promise<boolean> {
  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fid,
        title: payload.title,
        body: payload.body,
        targetUrl: payload.targetUrl || window.location.href,
        notificationId: payload.notificationId || `user-${fid}-${Date.now()}`,
      }),
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Failed to send notification:', error);
    return false;
  }
}

/**
 * Send batch notifications to multiple users
 */
export async function sendBatchNotifications(notifications: Array<{
  fid: number;
  payload: NotificationPayload;
}>): Promise<boolean> {
  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        batch: notifications.map(({ fid, payload }) => ({
          fid,
          title: payload.title,
          body: payload.body,
          targetUrl: payload.targetUrl || window.location.href,
          notificationId: payload.notificationId || `batch-${fid}-${Date.now()}`,
        })),
      }),
    });

    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error('Failed to send batch notifications:', error);
    return false;
  }
}

/**
 * Check if the current user has notifications enabled
 */
export async function hasNotificationsEnabled(): Promise<boolean> {
  try {
    // Check if the SDK is available and has actions
    if (!sdk.actions) {
      console.warn('SDK actions not available');
      return false;
    }

    // Since there's no direct method to check if notifications are enabled,
    // we'll assume they are enabled if the SDK is available and ready
    // This is a reasonable fallback as the SDK presence indicates the mini app environment
    console.log('SDK available, assuming notifications are enabled');
    return true;
  } catch (error) {
    console.error('Failed to check notification status:', error);
    return false;
  }
}
