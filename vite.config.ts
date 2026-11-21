import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 产物目录默认 `dist/`（GitHub 常见约定）。
 * 某些静态托管链路会把 dist/ 当成构建产物跳过，那里可以用 OUT_DIR=site 覆盖。
 */
const outDir = (globalThis as any).process?.env?.OUT_DIR || 'dist'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir,
    // 保留旧产物：文件名带哈希不会冲突，也避免受限环境不允许删除目录
    emptyOutDir: false,
    target: 'esnext',
    // 用 terser 而非默认的 esbuild 压缩：部分受限环境里 esbuild 的压缩服务会异常退出
    minify: 'terser',
    terserOptions: { format: { comments: false } },
    sourcemap: false,
    chunkSizeWarningLimit: 1400,
  },
  server: {
    port: 5173,
  },
})
