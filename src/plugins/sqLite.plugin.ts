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
      // Allow some time for jeep-sqlite to settle
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Pre-initialize connection to avoid "No available connection" on web
      await initConnection();
      console.log("✅ SQLite Web Store & Connection Initialized");
    } catch (err) {
      console.error("Error initializing SQLite web store:", err);
    }
  } else {
    // On native, Kysely handles the connection, but we can still pre-warm it
    try {
      await initConnection();
    } catch (err) {
      console.error("Error pre-warming native SQLite connection:", err);
    }
  }
};

export default sqLite;
