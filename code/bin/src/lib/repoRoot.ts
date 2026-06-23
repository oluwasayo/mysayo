import { fileURLToPath } from 'node:url'

export function resolveWorkspacePath(relativePath: string) {
  const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
  return `${repoRoot}/${relativePath}`
}
