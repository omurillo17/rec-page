import { defineConfig } from 'vite';

// Single self-contained ES module (driver.js, zod and core bundled in) so it can be
// dropped into Django static files or any HTML page with one <script type="module">.
export default defineConfig({
  build: {
    lib: { entry: 'src/index.ts', formats: ['es'], fileName: () => 'seventeen-training.js' },
    target: 'es2022',
    emptyOutDir: true,
    // Vite lib mode keeps ES output unminified; ask rolldown directly.
    rolldownOptions: { output: { minify: true } },
  },
});
