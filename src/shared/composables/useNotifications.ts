import { f7 } from "framework7-vue";
import { notificationService } from "@/shared/services/notifications/notification.service";
import { useSettingsStore } from "@/modules/settings/stores/settings.store"; // To check if enabled

export interface NotificationOptions {
  title?: string;
  subtitle?: string;
  body: string;
  type?: "success" | "warning" | "error" | "info";
  icon?: string;
  forceSystem?: boolean; // Force system notification even if app is open
  schedule?: Date; // If present, schedules a local notification
  data?: any;
}

export function useNotifications() {
  const settingsStore = useSettingsStore();

  /**
   * Main notification method
   * Routes to F7 (in-app) or System (background/scheduled)
   */
  const notify = async (options: NotificationOptions) => {
    if (!settingsStore.notificationsEnabled) return;

    if (options.schedule) {
      await notificationService.scheduleLocal({
        title: options.title || "Notification",
        body: options.body,
        schedule: { at: options.schedule },
        extra: options.data,
      });
      return;
    }

    // 3. Handle Immediate Notifications
    // If scheduling is not requested, we decide based on app state (or forceSystem flag)
    // Since this is a composable running in Vue context, we assume the app is "open"
    // unless called from a background listener (which is clearer to handle explicitly).

    if (options.forceSystem) {
      await notificationService.scheduleLocal({
        title: options.title || "Notification",
        body: options.body,
        extra: options.data,
      });
      return;
    }

    // 4. Default: In-App Framework7 Notification
    const icon = options.icon || getIconForType(options.type);

    f7.notification
      .create({
        icon: icon ? `<i class="f7-icons">${icon}</i>` : undefined,
        title: options.title || "Vueqa",
        subtitle: options.subtitle,
        text: options.body,
        closeTimeout: 3000,
        closeButton: true,
        cssClass: `notification-${options.type || "info"}`,
      })
      .open();
  };

  /**
   * Helper to get icon based on type
   */
  const getIconForType = (type?: string) => {
    switch (type) {
      case "success":
        return "checkmark_circle_fill";
      case "warning":
        return "exclamationmark_triangle_fill";
      case "error":
        return "xmark_circle_fill";
      default:
        return "bell_fill";
    }
  };

  /**
   * Request Permissions & Register
   */
  const enableNotifications = async () => {
    const granted = await notificationService.requestPermissions();
    if (granted) {
      const token = await notificationService.registerPushNotifications();
      console.log("Notifications enabled. Token:", token);
      return true;
    }
    return false;
  };

  const disableNotifications = async () => {
    await notificationService.unregister();
  };

  return {
    notify,
    enableNotifications,
    disableNotifications,
  };
}
