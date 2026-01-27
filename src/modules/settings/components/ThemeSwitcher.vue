<template>
  <F7List>
    <F7ListItem
      title="Theme"
      smart-select
      :smart-select-params="{ openIn: 'sheet' }"
    >
      <select :value="store.theme" @change="onThemeChange">
        <option value="auto">Auto</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </F7ListItem>
    <F7ListItem
      title="Notifications"
      :after="store.notificationsEnabled ? 'On' : 'Off'"
    >
      <template #after>
        <F7Toggle
          :checked="store.notificationsEnabled"
          @change="store.toggleNotifications"
        />
      </template>
    </F7ListItem>
  </F7List>
</template>

<script setup lang="ts">
import { useSettingsStore } from "@/modules/settings/stores/settings.store";

const store = useSettingsStore();

const onThemeChange = (e: Event) => {
  const target = e.target as HTMLSelectElement;
  store.setTheme(target.value as "auto" | "light" | "dark");
};
</script>
