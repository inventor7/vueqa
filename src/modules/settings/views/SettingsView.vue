<template>
  <F7Page>
    <F7Navbar title="Settings" large transparent :sliding="true" back-link>
    </F7Navbar>

    <!-- Settings -->
    <F7BlockTitle>Settings</F7BlockTitle>
    <F7List>
      <F7ListItem popup-open="#theme-popup" link title="Theme" :after="theme">
        <template #media>
          <F7Icon f7="paintbrush_fill" color="purple" />
        </template>
      </F7ListItem>

      <F7ListItem
        link
        :title="updateAvailable ? 'Update Available' : 'Check for Updates'"
        :footer="updateStatus"
        @click="handleUpdateItemClick"
      >
        <template #media>
          <F7Icon
            :f7="updateAvailable ? 'arrow_down_circle_fill' : 'arrow_clockwise'"
            :color="updateAvailable ? 'red' : 'blue'"
          />
        </template>
        <template #after>
          <F7Preloader v-if="isChecking || isDownloading" size="20" />
          <F7Badge v-else-if="updateAvailable" color="red">1</F7Badge>
        </template>
      </F7ListItem>
    </F7List>

    <!-- Debug Tools -->
    <F7BlockTitle>Debug Tools</F7BlockTitle>
    <F7List>
      <F7ListItem link title="Clear & Resync Database" @click="handleClearSync">
        <template #media>
          <F7Icon f7="arrow_clockwise_circle_fill" color="blue" />
        </template>
      </F7ListItem>

      <F7ListItem link title="View Logs" badge="Dev" badge-color="orange">
        <template #media>
          <F7Icon f7="doc_text_fill" color="gray" />
        </template>
      </F7ListItem>

      <F7ListItem
        link
        title="Test Notification"
        @click="handleTestNotification"
      >
        <template #media>
          <F7Icon f7="bubble_left_fill" color="pink" />
        </template>
      </F7ListItem>
    </F7List>

    <!-- Version Info -->
    <F7Block class="text-align-center">
      <p class="text-color-gray">
        Version {{ appVersion }}
        <span v-if="bundleVersion && bundleVersion !== 'builtin'">
          ({{ bundleVersion }})</span
        >
      </p>
      <p class="text-color-gray">{{ appEnvironment }} • {{ appChannel }}</p>
      <p class="text-color-gray">© 2025 Vueqa</p>
    </F7Block>

    <AppTheme />
  </F7Page>
</template>

<script setup lang="ts">
import AppTheme from "@/shared/components/app/AppTheme.vue";
import { useUpdater } from "@/shared/services/updater/useUpdater";
import { useNotifications } from "@/shared/composables/useNotifications";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

const settingsStore = useSettingsStore();
const {
  check,
  isChecking,
  updateAvailable,
  currentUpdate,
  startDownload,
  isDownloading,
  progress,
} = useUpdater();

const { notify } = useNotifications();

const appVersion = ref("1.0.0");
const bundleVersion = ref("");
const theme = ref("Auto");
const appEnvironment = ref(import.meta.env.VITE_ENVIRONMENT || "dev");
const appChannel = ref(import.meta.env.VITE_UPDATE_CHANNEL || "prod");

const updateStatus = computed(() => {
  if (isChecking.value) return "Checking...";
  if (isDownloading.value) {
    return `Downloading... ${progress.value.percent}%`;
  }
  if (updateAvailable.value && currentUpdate.value) {
    return `v${currentUpdate.value.version} available`;
  }
  return "Tap to check for updates";
});

const onThemeChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  settingsStore.setTheme(target.value as "auto" | "light" | "dark");
};

async function loadAppVersion() {
  try {
    if (Capacitor.isNativePlatform()) {
      const info = await App.getInfo();
      appVersion.value = info.version;
      const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
      const current = await CapacitorUpdater.current();
      bundleVersion.value = current.bundle.version;
    } else {
      // @ts-ignore
      appVersion.value = __APP_VERSION__;
    }
  } catch (error) {
    console.error("Error getting app version:", error);
  }
}

async function handleUpdateItemClick() {
  if (isDownloading.value || isChecking.value) return;

  if (updateAvailable.value && currentUpdate.value) {
    f7.dialog.confirm(
      `A new version (${currentUpdate.value.version}) is available. Would you like to download and install it now?`,
      "Update Available",
      async () => {
        try {
          await startDownload();
        } catch (error) {
          f7.dialog.alert(`Download failed: ${(error as Error).message}`);
        }
      },
    );
    return;
  }

  try {
    await check(false);
    if (!updateAvailable.value) {
      f7.toast
        .create({
          text: "You're on the latest version!",
          position: "center",
          closeTimeout: 2000,
        })
        .open();
    }
  } catch (error) {
    console.error("Error checking for updates:", error);
    f7.toast
      .create({
        text: "Failed to check for updates",
        position: "center",
        closeTimeout: 2000,
      })
      .open();
  }
}

async function handleClearSync() {
  f7.dialog.confirm(
    "This will clear your local database and resync. Continue?",
    async () => {
      f7.preloader.show();
      try {
        // TODO: Implement actual sync clear logic when sync service is ready
        // await syncService.clearAndResync();
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Mock delay
        f7.toast
          .create({
            text: "✓ Database cleared and resynced!",
            position: "center",
            closeTimeout: 2000,
          })
          .open();
      } catch (error) {
        f7.dialog.alert("Error resyncing database");
      } finally {
        f7.preloader.hide();
      }
    },
  );
}

function handleTestNotification() {
  f7.dialog
    .create({
      title: "Test Notifications",
      text: "Choose notification type:",
      buttons: [
        {
          text: "In-App (Toast)",
          onClick: () => {
            notify({
              title: "Test In-App",
              body: "This is a Framework7 toast notification!",
              type: "success",
            });
          },
        },
        {
          text: "System (5s Delay)",
          onClick: () => {
            const scheduleDate = new Date(Date.now() + 5000);
            notify({
              title: "Test System",
              body: "This is a scheduled system notification!",
              schedule: scheduleDate,
            });
            f7.toast
              .create({
                text: "Scheduled in 5s. Close the app to test!",
                closeTimeout: 2000,
              })
              .open();
          },
        },
        {
          text: "Cancel",
          color: "red",
        },
      ],
      verticalButtons: true,
    })
    .open();
}

onMounted(() => {
  loadAppVersion();
});
</script>
