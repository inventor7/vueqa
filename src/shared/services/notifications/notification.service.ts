import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema,
} from "@capacitor/local-notifications";
import {
  FirebaseMessaging,
  type GetTokenOptions,
} from "@capacitor-firebase/messaging";

export class NotificationService {
  private static instance: NotificationService;
  private pushToken: string | null = null;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Request permissions for both Local and Push notifications
   */
  async requestPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;

    try {
      const localResult = await LocalNotifications.requestPermissions();
      if (localResult.display !== "granted") return false;

      const pushResult = await FirebaseMessaging.requestPermissions();
      if (pushResult.receive !== "granted") return false;

      return true;
    } catch (error) {
      console.error("Error requesting permissions:", error);
      return false;
    }
  }

  /**
   * Check if permissions are currently granted
   */
  async checkPermissions(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;

    const localState = await LocalNotifications.checkPermissions();
    const pushState = await FirebaseMessaging.checkPermissions();

    return localState.display === "granted" && pushState.receive === "granted";
  }

  /**
   * Register for Push Notifications (FCM)
   */
  async registerPushNotifications(): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) return null;

    try {
      await this.createDefaultChannel();

      await FirebaseMessaging.addListener("tokenReceived", (event) => {
        this.pushToken = event.token;
      });

      const result = await FirebaseMessaging.getToken();
      this.pushToken = result.token;
      return result.token;
    } catch (error) {
      console.error("Error registering push:", error);
      return null;
    }
  }

  /**
   * Schedule a Local Notification
   */
  async scheduleLocal(
    options: Omit<LocalNotificationSchema, "id"> & { id?: number },
  ) {
    // Generate random ID if not provided
    const id = options.id || Math.floor(Math.random() * 100000000);

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: options.title,
          body: options.body,
          schedule: options.schedule || { at: new Date(Date.now() + 1000) }, // Default 1s delay
          sound: options.sound || "default",
          attachments: options.attachments,
          actionTypeId: options.actionTypeId,
          extra: options.extra,
          channelId: "default", // Ensure it uses our created channel
        },
      ],
    });
  }

  /**
   * Create default notification channel (Android)
   */
  private async createDefaultChannel() {
    if (Capacitor.getPlatform() !== "android") return;

    await LocalNotifications.createChannel({
      id: "default",
      name: "Default Notifications",
      description: "General app notifications",
      importance: 3, // Default
      visibility: 1, // Public
      vibration: true,
    });
  }

  /**
   * Unregister/Delete token (Logout)
   */
  async unregister() {
    if (!Capacitor.isNativePlatform()) return;
    await FirebaseMessaging.deleteToken();
    await FirebaseMessaging.removeAllListeners();
    this.pushToken = null;
  }
}

export const notificationService = NotificationService.getInstance();
