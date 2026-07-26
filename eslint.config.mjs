import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Registry-managed source. These files are vendored verbatim by the shadcn
    // CLI (`shadcn add ...`) from shadcn/ui and the Animate UI registry, and are
    // overwritten whenever a component is re-added — so fixing them in place
    // does not stick. They trip two React Compiler rules that ship with
    // eslint-config-next 16; the rules stay ON for everything we author.
    //
    // `src/hooks/` and the listed `src/lib/` files are registry-owned too: the
    // CLI drops transitive hook/util deps there. App-specific hooks therefore
    // live beside their feature or in `src/lib/hooks/`, never in `src/hooks/`.
    files: [
      "src/components/ui/**",
      "src/components/animate-ui/**",
      "src/hooks/**",
      "src/lib/utils.ts",
      "src/lib/get-strict-context.tsx",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/static-components": "off",
    },
  },
]);

export default eslintConfig;
