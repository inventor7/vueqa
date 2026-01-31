import { defineCustomElements as jeepSqlite } from "jeep-sqlite/loader";
import { Capacitor } from "@capacitor/core";
import { dbService, sqlite } from "@/shared/database";

/**
 * SQLite Plugin Initialization
 *
 * Sets up the SQLite database connection based on the platform:
 * - Web: Uses jeep-sqlite web component + IndexedDB
 * - Native: Uses native SQLite
 *
 * After initialization, dbService.isReady() will return true.
 */
const sqLite = async () => {
  if (Capacitor.getPlatform() === "web") {
    // Web platform requires jeep-sqlite custom element
    jeepSqlite(window);

    const jeepEl = document.createElement("jeep-sqlite");
    document.body.appendChild(jeepEl);

    try {
      await sqlite.initWebStore();
      await dbService.init();
      console.log("[SQLite Plugin] Web database initialized");
    } catch (err) {
      console.error("[SQLite Plugin] Web initialization failed:", err);
      throw err;
    }
  } else {
    // Native platform
    try {
      await dbService.init();
      console.log("[SQLite Plugin] Native database initialized");
    } catch (err) {
      console.error("[SQLite Plugin] Native initialization failed:", err);
      throw err;
    }
  }
};

export default sqLite;
