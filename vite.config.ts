import { defineConfig, type Plugin } from "vite";
import { generateManifest } from "./scripts/generate-manifest.ts";

function sampleManifestPlugin(): Plugin {
  return {
    name: "sample-manifest",
    buildStart() {
      generateManifest();
    },
  };
}

export default defineConfig({
  root: ".",
  publicDir: "public",
  plugins: [sampleManifestPlugin()],
});
