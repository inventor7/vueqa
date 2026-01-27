# Route Guards

This directory contains Framework7 route guards used to protect routes based on authentication, roles, and permissions.

## Available Guards

### `useAuthGuard`

- **File:** `useAuth.guard.ts`
- **Purpose:** Ensures the user is authenticated before accessing a route.
- **Behavior:**
  - Checks if the user is logged in using the `Auth` service.
  - If `isRequiredAuth` is true (default) and user is NOT logged in: Redirects to `/`.
  - If `isRequiredAuth` is false and user IS logged in: Redirects to `/home/`.
- **Usage:**
  ```typescript
  {
    path: '/protected-route/',
    beforeEnter: useAuthGuard,
  }
  ```

### `useRoleGuard`

- **File:** `useRole.guard.ts`
- **Purpose:** Restricts access based on user roles.
- **Behavior:**
  - Fetches user roles from `Auth` service.
  - Checks against a list of required roles (currently hardcoded to `["admin", "user"]`).
  - If user lacks required roles: Redirects to `/401/`.
- **Usage:**
  ```typescript
  {
    path: '/admin/',
    beforeEnter: useRoleGuard,
  }
  ```

### `usePermissionGuard`

- **File:** `usePermission.guard.ts`
- **Purpose:** Restricts access based on specific permissions.
- **Current Status:** Placeholder implementation (always resolves).
- **Future Usage:**
  ```typescript
  {
    path: '/sensitive-action/',
    beforeEnter: usePermissionGuard,
  }
  ```

## Extending Guards

To pass dynamic options (like specific roles) to a guard, you may need to wrap them or use route context data if supported by your router implementation, or refactor the guards to check `route.path` or other properties.
