import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/postcss";
import autoprefixer from "autoprefixer";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

export default {
  plugins: [
    tailwindcss({
      base: currentDir,
    }),
    autoprefixer(),
  ],
};
