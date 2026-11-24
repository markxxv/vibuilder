import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// Builds the editor into dist/ (committed, so consumers need no Node build). IIFE: sets window.Vibuilder.
export default defineConfig({
    plugins: [react(), tailwindcss()],
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
        outDir: 'dist',
        emptyOutDir: false,
        cssCodeSplit: false,
        lib: { entry: 'resources/js/editor/index.tsx', formats: ['iife'], name: 'VibuilderEditor', fileName: () => 'vibuilder-editor.js', cssFileName: 'vibuilder-editor' },
        rollupOptions: { output: { inlineDynamicImports: true } },
    },
});
