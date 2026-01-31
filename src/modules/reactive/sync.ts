/**
 * Reactive Module Sync Configuration
 */

import type { SyncTableConfig } from "@/shared/sync/types";

export const syncConfig: SyncTableConfig[] = [
  {
    table: "tasks",
    direction: "bi",
    priority: 1,
    delayMinutes: 0, // Real-time
    conflictStrategy: "server_wins",

    // Example of using the new features:
    // mediaColumns: ['image'],
    // fields: ['id', 'title', 'completed'],
    // transforms: { ... }
  },
];
