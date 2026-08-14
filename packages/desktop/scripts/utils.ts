import { $ } from "bun"
import { chmod, copyFile, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

const CLI_VERSION = "dev"

export type Channel = "dev" | "beta" | "prod"

export function resolveChannel(): Channel {
  const raw = Bun.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  if (raw === "latest") return "prod"
  return "dev"
}

export const CLI_BINARIES: Array<{ target: string; package: string; os: string; cpu: string }> = [
  {
    target: "linux-x64",
    package: "@opencode-ai/cli-node-linux-x64",
    os: "linux",
    cpu: "x64",
  },
  {
    target: "linux-arm64",
    package: "@opencode-ai/cli-node-linux-arm64",
    os: "linux",
    cpu: "arm64",
  },
]

export const CLI_TARGET = Bun.env.OPENCODE_CLI_TARGET

function nativeTarget() {
  // Node 26.4 SEA ships only linux-x64 and linux-arm64 binaries.
  return `linux-${process.arch}`
}

export function getCurrentCli(target = CLI_TARGET ?? nativeTarget()) {
  const binaryConfig = CLI_BINARIES.find((item) => item.target === target)
  if (!binaryConfig) throw new Error(`CLI configuration not available for target '${target}'`)

  return binaryConfig
}

export async function downloadCliToResources(version = CLI_VERSION, dest = windowsify("resources/opencode-cli")) {
  const cli = getCurrentCli()
  const directory = await mkdtemp(join(tmpdir(), "opencode-cli-"))
  try {
    await $`bun install --no-save --cwd ${directory} ${`${cli.package}@${version}`} ${`--os=${cli.os}`} ${`--cpu=${cli.cpu}`}`
    await copyCliToResources(join(directory, "node_modules", cli.package, "bin", "opencode2-node"), dest)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }

  console.log(`Copied ${cli.package}@${version} to ${dest}`)
}

export async function copyBuiltCliToResources(root: string, dest = windowsify("resources/opencode-cli")) {
  const cli = getCurrentCli()
  const directory = cli.package.replace("@opencode-ai/", "")
  await copyCliToResources(join(root, directory, "bin", "opencode2-node"), dest)
}

async function copyCliToResources(source: string, dest: string) {
  await copyFile(source, dest)
  await chmod(dest, 0o755)
}

export function windowsify(path: string) {
  if (path.endsWith(".exe")) return path
  return `${path}${process.platform === "win32" ? ".exe" : ""}`
}