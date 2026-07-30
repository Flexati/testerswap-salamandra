import { PushNotifications } from '@capacitor/push-notifications';

export const registerPush = async () => {
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive === 'granted') {
    await PushNotifications.register();
    PushNotifications.addListener('registration', ({ value }) => {
      console.log('Push registration token:', value);
    });
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received:', notification);
    });
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('Push action performed:', action);
    });
  } else {
    console.warn('Push notification permission not granted');
  }
};
