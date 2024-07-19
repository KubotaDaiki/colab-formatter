import { crx, defineManifest } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";

const manifest = defineManifest({
  name: "colab-formatter",
  version: "1.1.0",
  manifest_version: 3,
  description: "google colab上のコードをフォーマットする",
  permissions: ["scripting", "offscreen", "notifications"],
  host_permissions: [
    "https://colab.research.google.com/*",
    "https://www.kaggle.com/*",
  ],
  icons: {
    "16": "icon16.png",
    "48": "icon48.png",
    "128": "icon128.png",
  },
  background: {
    service_worker: "src/background.tsx",
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
      resources: ["*"],
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
        offscreen: "src/offscreen.tsx"
      },
      output: {
        entryFileNames: `assets/[name].js`, // offscreenのbuild時のファイル名を固定
      },
    }
  },
  plugins: [crx({ manifest })],
});
