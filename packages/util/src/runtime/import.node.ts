import { Script, constants } from "node:vm"
import { createRequire } from "node:module"
import { statSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

export async function importModule(specifier: string) {
  const imported = (await new Script(`import(${JSON.stringify(specifier)})`, {
    importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER,
  }).runInThisContext()) as unknown
  if (typeof imported !== "object" || imported === null) return imported

  const module = imported as Record<string, unknown>
  const exports = module["module.exports"]
  if (exports !== module.default || (typeof exports !== "object" && typeof exports !== "function") || exports === null)
    return imported
  return Object.assign({}, module, exports)
}

export function resolveModule(specifier: string, directory: string) {
  // import.meta.resolve does not survive the Vite node SEA bundle, so scope
  // synchronous resolution through a require bound to the caller package.
  const require = createRequire(path.join(directory, "package.json"))
  const resolve = (target: string) => {
    const resolved = require.resolve(target)
    if (resolved.startsWith("node:")) return resolved
    statSync(resolved)
    return pathToFileURL(resolved).href
  }
  try {
    return resolve(specifier)
  } catch (error) {
    if (path.extname(specifier) || !missing(error)) throw error
    // Node does not infer extensions for local files or legacy package
    // subpaths. Resolve each candidate natively so package exports still apply.
    for (const extension of [".ts", ".tsx", ".js", ".jsx", ".mts", ".mjs", ".cts", ".cjs"]) {
      try {
        return resolve(specifier + extension)
      } catch (cause) {
        if (!missing(cause)) throw cause
      }
    }
    throw error
  }
}

function missing(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    ["ENOENT", "ENOTDIR", "ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"].includes(String(error.code))
  )
}
