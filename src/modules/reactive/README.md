# Reactive Database Demo Module

## What This Demo Shows

This module provides a **live demonstration** of the reactive database layer in action. It showcases:

1. **Auto-Refetching Queries** - UI updates automatically when data changes
2. **Optimistic Updates** - Instant UI feedback before database confirmation
3. **Automatic Rollback** - Errors revert UI state automatically
4. **Type-Safe Operations** - Full TypeScript support throughout
5. **Live Event Logging** - Visible logs showing the reactivity lifecycle

## Features Demonstrated

### Task Management

- ✅ View task list (auto-updates via `useReactiveQuery`)
- ✅ Add new tasks (optimistic updates)
- ✅ Toggle completion status (optimistic updates)
- ✅ Delete tasks (optimistic with rollback)

### Reactive Behaviors

#### 1. Auto-Refetch

```ts
// Uses useReactiveQuery composable
const { data: tasks } = useReactiveQuery(
  () => db.selectFrom("tasks").selectAll().execute(),
  { tables: ["tasks"] },
);
// ⚡ Automatically refetches when 'tasks' table changes!
```

#### 2. Optimistic Updates

```ts
// Add task
await addTask({ title: "New Task", priority: "high" });
// UI updates IMMEDIATELY, syncs to DB in background
```

#### 3. Live Reactivity Logs

The demo includes a live log viewer that captures every stage of the lifecycle:

- `QUERY`: Database fetches
- `MUTATION`: Database writes
- `EVENT`: Mitt events being emitted
- `REFETCH`: Automatic synchronization triggers

## How to Test

1. **Open the app** and navigate to "Reactive SQLite Demo" from the Home screen.
2. **Add a task** - Notice the instant UI update and the corresponding logs.
3. **Toggle a task** - See the optimistic status change and subsequent DB sync.
4. **Delete a task** - Watch it disappear immediately while the DB handles the trace.
5. **Clear Logs** - Use the top right button to reset the visibility.

## Implementation Details

### Stack

- **View**: `ReactiveDemo.vue` - Framework7 UI with Lucide Icons
- **Composables**: `useTasks.ts` - Orchestrates the reactive lifecycle
- **Store**: `log.store.ts` - Manages the live event stream (Pinia)
- **Database**: `rdb` - Reactive Kysely instance that emits mutation events

### Architecture Flow

```
User Action (e.g., Toggle Task)
  ↓
useOptimisticMutation
  ↓
1. Update local state IMMEDIATELY (⚡ OPTIMISTIC)
  ↓
2. Execute database mutation (💾 DATABASE)
  ↓
3. rdb emits 'tasks:update' event (📢 EVENT)
  ↓
4. useReactiveQuery detects event in background
  ↓
5. Refetch query (debounced 100ms) (🔄 REFETCH)
  ↓
6. UI shows latest data from source of truth (✅ Query Complete)
```

## Files

```
reactive/
├── database/
│   └── schema.ts          # Task table definition
├── composables/
│   ├── useTasks.ts        # Main logic with logging
│   └── useReactiveDemo.ts # Database initialization
├── stores/
│   └── log.store.ts       # Reactive log management
└── views/
    └── ReactiveDemo.vue   # Polished demo UI
```

## "Big Dog" Principles Applied

- **Modularity**: Data logic separated into Services/Composables/Stores.
- **Single Responsibility**: Each file handles one part of the reactive chain.
- **Type Safety**: Full Kysely `Selectable`/`Insertable` type support.
- **Performance**: Debounced refetching to prevent rapid query spam.
