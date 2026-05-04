'use client'

import { useState, useEffect } from 'react';
import { savePushSubscription } from '@/app/actions/push-notifications';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    const checkSupport = () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsSupported(true);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPermission(Notification.permission);

        // Check current subscription status
        navigator.serviceWorker.ready.then(registration => {
          registration.pushManager.getSubscription().then(subscription => {
            setIsSubscribed(subscription !== null);
          });
        });
      }
    };

    checkSupport();
  }, []);

  // Utility to convert base64 VAPID key to Uint8Array
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const subscribeToPush = async () => {
    if (!isSupported) {
      console.warn('Push notifications are not supported by this browser.');
      return false;
    }

    try {
      // 1. Request Permission
      const currentPermission = await Notification.requestPermission();
      setPermission(currentPermission);

      if (currentPermission !== 'granted') {
        console.warn('Permission for notifications was denied.');
        return false;
      }

      // 2. Register/Get Service Worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // 3. Get VAPID public key from env
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
         console.error('VAPID public key is not configured.');
         return false;
      }

      // 4. Subscribe
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
      });

      // 5. Send subscription to server
      const subscriptionJSON = subscription.toJSON();
      const result = await savePushSubscription(subscriptionJSON);

      if (result.error) {
         console.error('Failed to save subscription to server:', result.error);
         return false;
      }

      setIsSubscribed(true);
      return true;

    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    }
  };

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribeToPush
  };
}
