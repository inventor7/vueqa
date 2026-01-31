import type { Router } from "framework7/types";

const routes: Router.RouteParameters[] = [
  {
    name: "reactive-demo",
    path: "/reactive-demo",

    async({ resolve }) {
      import("@/modules/reactive/views/ReactiveDemo.vue").then((vc) => {
        resolve({ component: vc.default });
      });
    },
  },
];

export default routes;
