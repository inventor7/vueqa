import Framework7 from "framework7/lite-bundle";
import Framework7Vue from "framework7-vue";

import App from "./App.vue";

import "./assets/css/icons.css";
import "./assets/css/app.css";
import { notificationsPlugin } from "./plugins/notifications.plugin";

Framework7.use(Framework7Vue);

const app = createApp(App);

await sqLitePlugin();
app.use(piniaPlugin);
app.use(i18nPlugin);
await openreplayPlugin(app);
await notificationsPlugin(app);

app.mount("#app");
