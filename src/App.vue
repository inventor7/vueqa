<template>
  <F7App v-bind="f7Params">
    <F7Views tabs animated class="safe-areas">
      <F7View name="home" id="view-home" main tab tab-active url="/"></F7View>
      <F7View name="demo" id="view-demo" tab url="/demo"></F7View>

      <F7Toolbar tabbar icons bottom class="toolbar-main-app">
        <div class="toolbar-pane">
          <F7Link
            tab-link="#view-home"
            tab-link-active
            icon-ios="f7:house_fill"
            icon-md="material:home"
            text="Home"
            ripple-color="transparent"
          />
          <F7Link
            tab-link="#view-demo"
            icon-ios="f7:speedometer"
            icon-md="material:speed"
            text="Demo"
            ripple-color="transparent"
          />
        </div>
      </F7Toolbar>
    </F7Views>

    <UpdatePrompt />
  </F7App>
</template>

<script setup lang="ts">
import type Framework7 from "framework7";
import UpdatePrompt from "./shared/components/updater/UpdatePrompt.vue";

const device = getDevice();
const f7Params = framework7();

onMounted(async () => {
  f7ready(async (f7: Framework7) => {
    if (device.capacitor) {
      await capacitorPlugin.init(f7);
    }
  });
});
</script>
