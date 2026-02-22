import { defineConfig } from "evalite/config";

export default defineConfig({
  viteConfig: {
    test: {
      include: ["evals/**/*.eval.ts", "**/*.eval.?(m)ts"],
    },
  },
});
