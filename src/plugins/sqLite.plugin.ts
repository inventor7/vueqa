import { defineCustomElements as jeepSqlite } from "jeep-sqlite/loader";
import { Capacitor } from "@capacitor/core";
import { sqlite, initConnection } from "@/shared/database";

const sqLite = async () => {
  if (Capacitor.getPlatform() === "web") {
    jeepSqlite(window);

    const jeepEl = document.createElement("jeep-sqlite");
    document.body.appendChild(jeepEl);

    try {
      await sqlite.initWebStore();
      await initConnection();
    } catch (err) {
      console.error("Error initializing SQLite web store:", err);
    }
  } else {
    try {
      await initConnection();
    } catch (err) {
      console.error("Error pre-warming native SQLite connection:", err);
    }
  }
};

export default sqLite;
