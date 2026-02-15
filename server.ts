import index from "./index.html";
import { generateManifest } from "./scripts/generate-manifest.ts";

generateManifest();

Bun.serve({
  routes: {
    "/": index,
  },
  async fetch(req) {
    const url = new URL(req.url);
    const file = Bun.file(`./public${url.pathname}`);
    if (await file.exists()) return new Response(file);
    return new Response("Not Found", { status: 404 });
  },
  development: {
    hmr: true,
    console: true,
  },
});
