import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import { resolve } from 'path';
import { createDevProxy } from './devProxy';

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
    // 同 vitest.config.ts：保证 pinia / vue 只有一份实例，否则共享包里的 store 拿不到活动 Pinia
    dedupe: ['vue', 'vue-router', 'pinia'],
  },
  server: {
    port: 5183,
    proxy: createDevProxy(),
  },
  build: {
    outDir: '../wwwroot',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@visactor/vtable-gantt')) return 'vtable-gantt';
          if (id.includes('node_modules/@visactor')) return 'vtable';
        },
      },
    },
  },
});
