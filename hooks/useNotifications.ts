import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Failed to get push token for push notification!');
    return null;
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#f1e05a',
    });
  }

  return true;
}

export async function scheduleDailyReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Schedule a local notification for 8:00 PM every day
  // Using the updated trigger format for Expo SDK 53+
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🔥 Streak at Risk!",
        body: "Don't forget to push some code to save your streak today!",
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableNotificationTriggerInputTypes.DAILY,
        hour: 20,
        minute: 0,
      } as any, // Cast to any to bypass strict type check if needed in some environments
    });
    console.log('DEBUG: Notification scheduled successfully');
  } catch (error) {
    console.error('DEBUG: Failed to schedule notification', error);
  }
}

