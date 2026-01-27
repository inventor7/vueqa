import type { App } from "vue";
import { notificationService } from "@/shared/services/notifications/notification.service";
import { LocalNotifications } from "@capacitor/local-notifications";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { f7 } from "framework7-vue";

export const notificationsPlugin = async (app: App) => {
  const hasPermissions = await notificationService.checkPermissions();

  if (hasPermissions) {
    await notificationService.registerPushNotifications();

    await LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (notification) => {
        console.log("Local Notification Action:", notification);
      },
    );

    await FirebaseMessaging.addListener(
      "notificationActionPerformed",
      (event) => {
        console.log("Push Notification Action:", event);
      },
    );

    await FirebaseMessaging.addListener("notificationReceived", (event) => {
      f7.notification
        .create({
          title: event.notification.title || "New Message",
          text: event.notification.body || "",
          closeTimeout: 3000,
          closeButton: true,
        })
        .open();
    });
  }
};
