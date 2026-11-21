import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Builds a lightweight "catalog" of all lessons at build time:
 * just the metadata (title, level, region…), not the full text.
 * Full lessons are loaded on demand (and cached offline by the service worker).
 */
function catalogPlugin(): Plugin {
  const VIRTUAL = 'virtual:catalog';
  const RESOLVED = '\0' + VIRTUAL;
  const contentDir = path.resolve(process.cwd(), 'content');

  function build() {
    const regions = JSON.parse(fs.readFileSync(path.join(contentDir, 'regions.json'), 'utf8'));
    const lessons: unknown[] = [];
    const lessonsDir = path.join(contentDir, 'lessons');
    for (const region of fs.readdirSync(lessonsDir)) {
      const dir = path.join(lessonsDir, region);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.json')) continue;
        const l = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        lessons.push({
          id: l.id,
          region: l.region,
          topic: l.topic,
          level: l.level,
          bridge: !!l.bridge,
          title: l.title,
          estimated_minutes: l.estimated_minutes,
          prerequisites: l.prerequisites ?? [],
        });
      }
    }
    const gates: unknown[] = [];
    const gatesDir = path.join(contentDir, 'gates');
    if (fs.existsSync(gatesDir)) {
      for (const file of fs.readdirSync(gatesDir)) {
        if (!file.endsWith('.json')) continue;
        const data = JSON.parse(fs.readFileSync(path.join(gatesDir, file), 'utf8'));
        gates.push(...(Array.isArray(data) ? data : [data]));
      }
    }
    return `export default ${JSON.stringify({ regions, lessons, gates })};`;
  }

  return {
    name: 'awakening-catalog',
    resolveId(id) {
      if (id === VIRTUAL) return RESOLVED;
    },
    load(id) {
      if (id === RESOLVED) return build();
    },
    configureServer(server) {
      server.watcher.add(contentDir);
      server.watcher.on('all', (_e, file) => {
        if (file.startsWith(contentDir)) {
          const mod = server.moduleGraph.getModuleById(RESOLVED);
          if (mod) server.moduleGraph.invalidateModule(mod);
          server.ws.send({ type: 'full-reload' });
        }
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the site from /<repo-name>/ — the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH || '/',
  plugins: [
    preact(),
    catalogPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['fonts/*.woff2', 'icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Awakening',
        short_name: 'Awakening',
        description: 'Level up by learning. Daily 10-15 minute sessions across all of human knowledge.',
        display: 'standalone',
        orientation: 'any',
        background_color: '#11151D',
        theme_color: '#11151D',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything: app shell, every lesson chunk, fonts, icons → fully offline.
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 600,
  },
});
