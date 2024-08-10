import { crx, defineManifest } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";

const manifest = defineManifest({
  name: "colab-formatter",
  version: "1.1.1",
  manifest_version: 3,
  description: "google colab上のコードをフォーマットする",
  permissions: ["scripting", "offscreen", "notifications"],
  host_permissions: [
    "https://colab.research.google.com/*",
    "https://www.kaggle.com/*",
  ],
  icons: {
    "16": "assets/icon16.png",
    "48": "assets/icon48.png",
    "128": "assets/icon128.png",
  },
  background: {
    service_worker: "src/background.ts",
  },
  commands: {
    format: {
      suggested_key: {
        default: "Alt+S",
      },
      description: "フォーマットを実行",
    },
  },
  web_accessible_resources: [
    {
      resources: ["assets/*/*"],
      matches: ["<all_urls>"],
    },
    {
      resources: ["src/offscreen.html"],
      matches: ["<all_urls>"],
    },
  ],
  content_security_policy: {
    extension_pages:
      "script-src 'self' 'wasm-unsafe-eval' ; object-src 'self';",
  },
});

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        offscreen: 'src/offscreen.html',
      },
    },
  },
  plugins: [crx({ manifest })],
});
