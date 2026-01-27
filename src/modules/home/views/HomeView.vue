<template>
  <F7Page>
    <F7Navbar title="Vueqa Template" large transparent :sliding="true">
      <F7NavRight>
        <F7Link icon-f7="gear" href="/settings/"></F7Link>
      </F7NavRight>
    </F7Navbar>

    <F7BlockTitle>Welcome to Vueqa</F7BlockTitle>
    <F7Block strong class="rounded-2xl!">
      <p>
        <strong>Vueqa</strong> is a production-ready "Big Dog" template for
        building scalable, offline-first mobile apps with
        <strong>Vue 3</strong>, <strong>Framework7</strong>, and
        <strong>Capacitor</strong>.
      </p>
    </F7Block>

    <F7BlockTitle>Core Features</F7BlockTitle>
    <F7List media-list>
      <F7ListItem
        title="Modular Architecture"
        subtitle="Scalable Folder Structure"
      >
        <template #media>
          <F7Icon f7="square_grid_2x2_fill" color="blue" />
        </template>
        <template #text>
          Feature-based modules (store, view, routes) vs Shared utilities.
        </template>
      </F7ListItem>

      <F7ListItem title="Framework7" subtitle="Native UI/UX">
        <template #media>
          <F7Icon f7="layers_alt_fill" color="pink" />
        </template>
        <template #text>
          Pixel-perfect iOS & Android native look-and-feel.
        </template>
      </F7ListItem>

      <F7ListItem title="OpenReplay" subtitle="Session Replay & Debugging">
        <template #media>
          <F7Icon f7="play_circle_fill" color="orange" />
        </template>
        <template #text>
          Full session recording and observability for advanced debugging.
        </template>
      </F7ListItem>

      <F7ListItem title="Offline-First Database" subtitle="SQLite + Kysely ORM">
        <template #media>
          <F7Icon f7="circle_grid_hex_fill" color="green" />
        </template>
        <template #text>
          Type-safe SQL queries on top of high-performance native SQLite
          storage.
        </template>
      </F7ListItem>

      <F7ListItem title="Unified Notifications" subtitle="Local & Push">
        <template #media>
          <F7Icon f7="bell_fill" color="red" />
        </template>
        <template #text>
          Smart routing: In-App Toasts when open, System Notifications when
          backgrounded.
        </template>
      </F7ListItem>

      <F7ListItem
        title="Developer Experience"
        subtitle="Auto-imports & DX Tools"
      >
        <template #media>
          <F7Icon f7="rocket_fill" color="yellow" />
        </template>
        <template #text>
          Zero-boilerplate with auto-imports, icons, and Turbo Console
          integration.
        </template>
      </F7ListItem>

      <F7ListItem title="OTA Updates" subtitle="Powered by Capucho Platform">
        <template #media>
          <F7Icon f7="arrow_down_circle_fill" color="purple" />
        </template>
        <template #text>
          Seamlessly delivery updates (OTA) and manage native releases via
          Capucho.
        </template>
      </F7ListItem>
    </F7List>

    <F7Block class="text-center text-gray-400 text-sm">
      <p>
        Start building by creating a new module in <code>src/modules/</code>.
      </p>
    </F7Block>
  </F7Page>
</template>

<script setup lang="ts">
// Clean Home View - Documentation Only
</script>
