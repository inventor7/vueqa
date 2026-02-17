# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vueqa is a modular, mobile-first ERP application built with Vue 3, Framework7, and Capacitor. The project features an offline-first architecture with reactive SQLite database, OTA updates, and cross-platform deployment (iOS/Android/Web).

**Tech Stack:**
- Vue 3 (Composition API with `<script setup>`)
- Framework7 (lite-bundle) for mobile UI
- Capacitor 8 for native features
- Pinia for state management
- Kysely for type-safe SQL queries
- Vite 8 (beta) as bundler
- TypeScript throughout

## Development Commands

### Core Development
```bash
pnpm install              # Install dependencies
pnpm dev                  # Start development server (localhost:5173)
pnpm type-check           # Run TypeScript type checking
pnpm build                # Production build with type checking
pnpm preview              # Preview production build
```

### Environment-Specific Development
```bash
pnpm dev:staging          # Dev server with staging env
pnpm dev:prod             # Dev server with production env
pnpm build:dev            # Build for dev environment
pnpm build:staging        # Build for staging environment
pnpm build:prod           # Build for production environment
```

### Mobile Development
```bash
# Android
pnpm run:android:dev      # Build + configure + run on Android (dev)
pnpm run:android:staging  # Build + configure + run on Android (staging)

# iOS
pnpm run:ios:dev          # Build + configure + run on iOS (dev)
pnpm run:ios:staging      # Build + configure + run on iOS (staging)

# Asset generation
pnpm assets:dev           # Generate Android assets for dev
pnpm assets:staging       # Generate Android assets for staging
```

### Deployment & Updates
```bash
pnpm sync-version         # Sync version from package.json
pnpm version:patch        # Bump patch version (x.x.X)
pnpm version:minor        # Bump minor version (x.X.0)
pnpm capgo:upload:staging # Upload OTA update to staging
pnpm capgo:upload:prod    # Upload OTA update to production
pnpm release:staging      # Version bump + upload to staging
pnpm release:prod         # Version bump + upload to production
```

## Architecture

### Modular Structure

The codebase follows a strict modular pattern where each feature is self-contained:

```
src/
├── modules/{module-name}/     # Feature modules
│   ├── components/            # Module-specific components
│   ├── composables/           # Module-specific composables
│   ├── database/              # Module-specific schema/migrations
│   ├── router/
│   │   └── routes/            # Module routes (auto-imported)
│   ├── services/              # Module business logic
│   ├── stores/                # Module Pinia stores
│   ├── types/                 # Module types
│   └── views/                 # Module pages
├── shared/                    # Cross-module utilities
│   ├── components/            # Shared components
│   ├── composables/           # Shared composables (useReactiveQuery, etc.)
│   ├── database/              # Core database infrastructure
│   │   ├── reactive/          # Reactive SQLite layer
│   │   ├── migrations/        # Global migrations
│   │   ├── DatabaseService.ts # Main DB singleton
│   │   └── global.schema.ts   # Kysely schema definitions
│   ├── services/              # Cross-cutting services
│   ├── stores/                # Global stores
│   ├── types/                 # Shared types
│   └── utils/                 # Utility functions
├── plugins/                   # App initialization plugins
└── router/                    # Router setup (auto-imports module routes)
```

**Key Principles:**
- Each module is isolated and can be developed independently
- Routes are auto-discovered from `modules/*/router/routes/*.routes.ts`
- Use `@/` for `src/`, `@modules/` for `src/modules/`, `@shared/` for `src/shared/`
- Store files use `use{Feature}.stores.ts` pattern (note the plural "stores")

### Reactive Database Layer

The database layer is the core architectural feature. It provides automatic UI updates when data changes.

**Key Files:**
- `src/shared/database/DatabaseService.ts` - Main database singleton
- `src/shared/database/reactive/reactiveDb.ts` - Reactive Kysely wrapper (`rdb`)
- `src/shared/database/reactive/dbEvents.ts` - Event system (uses mitt)
- `src/shared/composables/useReactiveQuery.ts` - Auto-refetching queries
- `src/shared/composables/useOptimisticMutation.ts` - Optimistic updates

**Usage Pattern:**
```typescript
// In a composable/component:
import { rdb } from "@/shared/database";
import { useReactiveQuery, useOptimisticMutation } from "@/shared/composables";

// Reactive query - auto-refetches when 'tasks' table changes
const { data: tasks, isLoading } = useReactiveQuery(
  () => rdb.selectFrom("tasks").selectAll().execute(),
  { tables: ["tasks"] }
);

// Optimistic mutation - instant UI update, then sync to DB
const { mutate: addTask } = useOptimisticMutation({
  table: "tasks",
  optimisticUpdate: (newTask) => {
    tasks.value = [...tasks.value, newTask];
  },
  mutation: async (newTask) => {
    return await rdb.insertInto("tasks").values(newTask).execute();
  },
});
```

**Important Notes:**
- Use `rdb` (reactive database) instead of `db` for mutations that need reactivity
- Use `db` from `dbService.getDb()` for read-only queries outside reactive context
- All `rdb` mutations (insert/update/delete) emit events automatically
- Migrations run automatically on app startup via `DatabaseMigrator`

### Database Migrations

**Location:** `src/shared/database/migrations/` and `src/modules/*/database/migrations/`

**Creating Migrations:**
1. Name format: `{timestamp}_{description}.ts` (e.g., `20240101_create_tasks_table.ts`)
2. Export a migration object with `up` and `down` methods
3. Use Kysely schema builder for type safety

**Example:**
```typescript
import { type Migration } from "../migrator";

export const migration: Migration = {
  up: async (db) => {
    await db.schema
      .createTable("tasks")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("title", "text", (col) => col.notNull())
      .execute();
  },
  down: async (db) => {
    await db.schema.dropTable("tasks").execute();
  },
};
```

**Migration Helpers:** (from `migrations/_helpers.ts`)
- `addBaseColumns()` - Adds `created_at`, `updated_at`
- `addLocalColumns()` - Adds sync columns for offline-first apps
- `generateLocalRuid()` - Generates client-side unique IDs

### Auto-Imports

The project uses extensive auto-imports to reduce boilerplate:

**APIs (auto-imported):**
- Vue: `ref`, `computed`, `watch`, `onMounted`, etc.
- Vue Router: `useRoute`, `useRouter`
- Pinia: `defineStore`, `storeToRefs`
- VueUse: `useLocalStorage`, `watchDebounced`, etc.
- Vue I18n: `useI18n`, `$t`
- Framework7: `f7`, `f7ready`, `theme`

**Components (auto-imported):**
- All `.vue` files in `src/components/**`
- All `.vue` files in `src/modules/**/components/**`
- Framework7 components (e.g., `<f7-page>`, `<f7-button>`)
- Icons via `unplugin-icons` (use `<i-lucide-check />` for Lucide icons)

**No manual imports needed** for these! TypeScript declarations are auto-generated in `auto-imports.d.ts` and `components.d.ts`.

### Framework7 Integration

**Routing:** Framework7 uses its own router, not Vue Router. Routes are defined in module-specific `routes/*.routes.ts` files.

**Navigation:**
```typescript
// Use f7router for navigation
import { f7router } from "framework7-vue";

f7router.navigate("/tasks");
f7router.back();
```

**UI Patterns:**
- Use Framework7 components for native-like mobile UI
- Theme adapts automatically to iOS/Android/Web
- Leverage `<f7-page>`, `<f7-navbar>`, `<f7-toolbar>`, `<f7-list>`, etc.

## Environment Configuration

**Multiple Build Targets:**
- `dev` - Local development with hot reload
- `staging` - Pre-production testing
- `prod` - Production
- `generic` - White-label builds

**Environment Files:**
- `.env.local` - Local overrides (gitignored)
- `build/{env}/.env.{env}` - Environment-specific configs
- `build/{env}/trapeze.{env}.yaml` - Native config (app ID, name, versions)

**Key Variables:**
- `VITE_APP_ID` - Capacitor app ID (e.g., `io.vueqa.inv.dev`)
- `VITE_APP_NAME` - Display name
- `VITE_DB_FILENAME` - SQLite database filename
- `VITE_UPDATE_API_URL` - Capucho OTA update server
- `VITE_UPDATE_CHANNEL` - Update channel (dev/staging/production)

## Plugin System

**Plugin Initialization Order** (in `main.ts`):
1. `sqLitePlugin` - Database initialization (MUST be first)
2. `piniaPlugin` - State management
3. `i18nPlugin` - Internationalization
4. `openreplayPlugin` - Session recording
5. `notificationsPlugin` - Push notifications

## Code Style Guidelines

- **Always use Composition API with `<script setup>`** (NOT Options API)
- **TypeScript everywhere** - No plain `.js` files
- Use `const` over `let` where possible
- Prefer `async/await` over `.then()`
- Use Kysely's type-safe query builder (no raw SQL strings unless necessary)
- Component names use PascalCase (e.g., `TaskList.vue`)
- Composables use `use{Feature}` pattern (e.g., `useTasks.ts`)
- Keep components small and focused (prefer composition over inheritance)

## Vite Configuration

**Key Features:**
- Advanced chunk splitting for optimal loading (see `vite.config.ts`)
- Framework7 components split separately for tree-shaking
- Swiper elements marked as custom elements (no Vue warnings)
- Source maps enabled in production for debugging

**Path Aliases:**
- `@/` → `src/`
- `@modules/` → `src/modules/`
- `@shared/` → `src/shared/`

## Common Patterns

### Creating a New Module

1. Create directory: `src/modules/{module-name}/`
2. Add required folders: `components/`, `composables/`, `router/routes/`, `views/`
3. Create routes file: `router/routes/{module}.routes.ts` (auto-discovered)
4. If database needed: Create `database/schema.ts` and migrations

### Adding a Database Table

1. Define schema in `src/shared/database/global.schema.ts` (or module-specific)
2. Create migration in `src/shared/database/migrations/`
3. Use migration helpers for standard columns (`addBaseColumns`, etc.)
4. Schema will be auto-applied on next app launch

### Working with Reactive Queries

**For data that needs real-time updates:**
```typescript
const { data, isLoading, error, refetch } = useReactiveQuery(
  () => rdb.selectFrom("tasks").where("status", "=", "active").selectAll().execute(),
  {
    tables: ["tasks"],
    refetchOn: ["insert", "update"], // Optional: filter change types
  }
);
```

**For optimistic mutations:**
```typescript
const { mutate, isLoading } = useOptimisticMutation({
  table: "tasks",
  optimisticUpdate: (data) => {
    // Update local state immediately
    localTasks.value.push(data);
  },
  mutation: async (data) => {
    // Actual DB write
    return await rdb.insertInto("tasks").values(data).execute();
  },
  onError: (rollback) => {
    // Auto-rolls back optimistic change
    rollback();
  },
});
```

## Testing & Debugging

- **Vue DevTools** enabled in development
- **Turbo Console** enhances console logging with file/line info
- **OpenReplay** session recording configured (toggle via env var)
- Check `src/modules/reactive/` for a working example of the reactive database layer

## Mobile-Specific Notes

- **SQLite:** Uses `jeep-sqlite` on web, native SQLite on iOS/Android
- **Capacitor Plugins:** Always check platform with `Capacitor.getPlatform()`
- **Live Reload:** Configure in `.env.local` with `VITE_LIVE_RELOAD=true`
- **OTA Updates:** Managed by Capgo (via Capucho platform) - auto-update on app launch
- **Trapeze:** Automates native config updates (version codes, app IDs, etc.)

## Important Constraints

- **Vite 8 Beta:** Using cutting-edge Vite - may have compatibility issues with some plugins
- **Framework7 Lite Bundle:** Not all F7 components included - check docs before using advanced components
- **Database Migrations:** Always reversible - implement both `up` and `down` methods
- **Reactive Queries:** Debounced by 100ms default to prevent query spam
