import { homedir } from "node:os"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { app } from "electron"
import type { Endpoint } from "@opencode/client/service"

// The main thread idles between showing the first window and evaluating the main bundle, waiting
// for the renderer's asset requests. That slot is long enough to find out whether a compatible
// background service is already running, so the renderer's first data request is not the first
// moment anyone asks. The probe only looks; a service that has to be started waits for the layers,
// which set the environment the CLI expects.
let probe: Promise<Endpoint | undefined> | undefined

// Mirrors cli ServiceConfig.filename() so the desktop reads the same registration file the CLI
// wrote: `service.json` for latest/dev/beta/next, `service-<channel>.json` otherwise.
export function registrationFile(channel = import.meta.env.OPENCODE_CHANNEL) {
  const name =
    channel === "local"
      ? "service-local.json"
      : channel === "latest" || channel === "dev" || channel === "beta" || channel === "next"
        ? "service.json"
        : `service-${channel.replace(/[^a-zA-Z0-9._-]/g, "-")}.json`
  const stateHome = process.env.XDG_STATE_HOME ?? join(homedir(), ".local", "state")
  return join(stateHome, "opencode", name)
}

export function startSidecarProbe() {
  if (!app.isPackaged) return
  const version = bundledVersion()
  const file = registrationFile()

  if (!version) return
  probe = import("@opencode/client/service")
    .then(({ Service }) => Service.discover({ version, file }))
    .catch(() => undefined)
}

export function sidecarProbe(file?: string) {
  return probe ?? Promise.resolve(undefined)
}

function bundledVersion() {
  try {
    return readFileSync(path.join(process.resourcesPath, "opencode-cli.version"), "utf8").trim()
  } catch {
    return ""
  }
}
