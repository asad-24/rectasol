import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(import.meta.url);

// In-memory compilation only. Next's server-only boundary is enforced by the build.
export function createLoader(stubs = {}) {
  const cache = new Map();
  function load(relativePath) {
    const filename = path.join(root, relativePath);
    if (cache.has(filename)) return cache.get(filename);
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    });
    const loaded = { exports: {} };
    const localRequire = (name) => {
      if (name === "server-only") return {};
      if (Object.hasOwn(stubs, name)) return stubs[name];
      return name.startsWith("@/") ? load(`src/${name.slice(2)}.ts`) : require(name);
    };
    new Function("require", "module", "exports", outputText)(localRequire, loaded, loaded.exports);
    cache.set(filename, loaded.exports);
    return loaded.exports;
  }
  return load;
}
