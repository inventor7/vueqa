import type { Router } from "framework7/types";

const demoRoutes: Router.RouteParameters[] = [
  {
    name: "demo",
    path: "/demo",
    routes: [],

    // beforeEnter: (context) => useAuthGuard(context),

    async({ resolve }) {
      import("@/modules/demo/views/DemoView.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
];

export default demoRoutes;
