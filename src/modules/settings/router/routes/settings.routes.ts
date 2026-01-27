import type { Router } from "framework7/types";

const settingsRoutes: Router.RouteParameters[] = [
  {
    name: "settings",
    path: "/settings",
    routes: [],

    async({ resolve }) {
      import("@/modules/settings/views/SettingsView.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
];

export default settingsRoutes;
