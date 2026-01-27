import { notificationService } from "@/shared/services/notifications/notification.service";

export const useSettingsStore = defineStore(
  "settings",
  () => {
    const theme = ref<"auto" | "light" | "dark">("auto");
    const notificationsEnabled = ref(true);
    const language = ref("en");
    const currency = ref("USD");

    function setTheme(newTheme: "auto" | "light" | "dark") {
      theme.value = newTheme;
    }

    async function toggleNotifications() {
      if (!notificationsEnabled.value) {
        const granted = await notificationService.requestPermissions();
        if (granted) {
          notificationsEnabled.value = true;
          await notificationService.registerPushNotifications();
        } else {
          notificationsEnabled.value = false;
        }
      } else {
        notificationsEnabled.value = false;
        await notificationService.unregister();
      }
    }

    return {
      theme,
      notificationsEnabled,
      language,
      currency,
      setTheme,
      toggleNotifications,
    };
  },
  {
    persist: true,
  },
);
