import { App } from "@capacitor/app";
const { init: initUpdater, check: checkUpdates } = useUpdater();

const useAppUpdater = async () => {
  await initUpdater();
  App.addListener(
    "resume",

    async () => {
      await checkUpdates();
    },
  );
};

export default useAppUpdater;
