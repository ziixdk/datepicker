/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'ZiixDatePicker',
      formats: ['es'],
      fileName: () => 'ziix-datepicker.js',
    },
    rollupOptions: {
      // dayjs is a peer dependency — keep it out of the bundle
      external: ['dayjs', 'dayjs/plugin/utc', 'dayjs/plugin/timezone'],
      output: {
        assetFileNames: 'ziix-datepicker.[ext]',
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
  },
  plugins: [dts({ rollupTypes: true })],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
