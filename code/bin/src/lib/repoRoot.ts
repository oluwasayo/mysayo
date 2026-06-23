import { isAbsolute, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../../../..')

export const resolveWorkspacePath = (path: string) =>
  isAbsolute(path) ? path : resolve(process.env['INIT_CWD'] ?? repoRoot, path)
