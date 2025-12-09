import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // 關鍵修正：這裡必須跟您的 GitHub Repository 名稱一樣，前後都要有斜線
  base: '/am-booking/', 
  build: {
    outDir: 'dist',
  }
});
