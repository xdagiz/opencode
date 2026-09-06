import { Script, constants } from "node:vm"
import { registerHooks } from "node:module"
import { statSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

declare global {
  var __ocEsmResolve: ((specifier: string, directory: string) => string) | undefined
}

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
  const esmResolve = globalThis.__ocEsmResolve ?? localResolve
  const resolve = (target: string) => {
    const input = path.isAbsolute(target) ? pathToFileURL(target).href : target
    const resolved = esmResolve(input, directory)
    if (resolved.startsWith("file:")) statSync(new URL(resolved))
    return resolved
  }
  try {
    return resolve(specifier)
  } catch (error) {
    if (path.extname(specifier) || !missing(error)) throw error
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

function localResolve(specifier: string, directory: string) {
  const hook = registerHooks({
    resolve(target, context, nextResolve) {
      return nextResolve(target, { ...context, parentURL: pathToFileURL(path.join(directory, "package.json")).href })
    },
  })
  try {
    return import.meta.resolve(specifier)
  } finally {
    hook.deregister()
  }
}

function missing(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    ["ENOENT", "ENOTDIR", "ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"].includes(String(error.code))
  )
}
