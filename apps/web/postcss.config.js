import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: [
    tailwindcss({
      config: path.join(currentDir, "tailwind.config.js"),
    }),
    autoprefixer(),
  ],
};
