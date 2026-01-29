import { defineStore } from "pinia";
import { ref } from "vue";

export type LogType = "query" | "mutation" | "event" | "refetch";

export interface ReactiveLog {
  id: number;
  time: string;
  type: LogType;
  message: string;
}

/**
 * Store for managing reactive logs in the demo.
 * Demonstrates modular state management.
 */
export const useLogStore = defineStore("reactiveLogs", () => {
  const logs = ref<ReactiveLog[]>([]);
  let logIdCounter = 0;

  /**
   * Add a new log entry
   */
  function addLog(type: LogType, message: string) {
    const now = new Date();
    const time =
      now.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }) +
      "." +
      String(now.getMilliseconds()).padStart(3, "0");

    logs.value.unshift({
      id: ++logIdCounter,
      time,
      type,
      message,
    });

    // Keep only last 100 logs
    if (logs.value.length > 100) {
      logs.value = logs.value.slice(0, 100);
    }

    // Also mirrored to console for convenience
    console.log(`[${type.toUpperCase()}] ${time} - ${message}`);
  }

  /**
   * Clear all logs
   */
  function clearLogs() {
    logs.value = [];
    addLog("event", "🧹 Logs cleared");
  }

  return {
    logs,
    addLog,
    clearLogs,
  };
});
