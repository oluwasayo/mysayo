import { readFileSync, writeFileSync } from 'node:fs'

import { resolveWorkspacePath } from '@/lib/repoRoot'
import {
  parseArgs,
  printError,
  printStatus,
  showHelp,
  type ValidOptions,
} from '@/lib/utils'

const validOptions = {
  '--ci': {
    description: 'CI mode: exit with code 0 if only nonsensical changes exist',
    name: 'ci',
    type: 'boolean',
  },
  '--input': {
    description: 'Input plan file to filter',
    name: 'input',
    required: true,
    type: 'string',
  },
  '--output': {
    description: 'Output file for filtered plan',
    name: 'output',
    required: true,
    type: 'string',
  },
} satisfies ValidOptions

function filterPlan(planOutput: string) {
  const cfPagesStart =
    '# module.cloudflare_pages[0].cloudflare_pages_project.web will be updated in-place'
  const startIndex = planOutput.indexOf(cfPagesStart)

  if (startIndex === -1) {
    return planOutput
  }

  const searchStart = startIndex + cfPagesStart.length
  const nextModuleIndex = planOutput.indexOf('# module', searchStart)
  const filterPlaceholder =
    '# module.cloudflare_pages[0].cloudflare_pages_project.web will be updated in-place (hidden by filter)\n\n'

  if (nextModuleIndex !== -1) {
    return (
      planOutput.substring(0, startIndex) +
      filterPlaceholder +
      planOutput.substring(nextModuleIndex)
    )
  }

  const planSummaryIndex = planOutput.indexOf('Plan:', searchStart)
  if (planSummaryIndex !== -1) {
    return (
      planOutput.substring(0, startIndex) +
      filterPlaceholder +
      planOutput.substring(planSummaryIndex)
    )
  }

  return planOutput
}

function hasOnlyNonsensicalChanges(planOutput: string) {
  return /Plan: 0 to add, 1 to change, 0 to destroy\./.test(planOutput)
}

async function main() {
  const args = parseArgs(validOptions)

  if (args.help) {
    showHelp('filter-terraform-plan.ts', validOptions, [
      'npm run filter-terraform-plan -- --input plan.txt --output plan-filtered.txt',
      'npm run filter-terraform-plan -- --input plan.txt --output plan-filtered.txt --ci',
    ])
    return
  }

  if (!args.input || !args.output) {
    printError('Both --input and --output are required')
    process.exit(1)
  }

  const inputPath = resolveWorkspacePath(String(args.input))
  const outputPath = resolveWorkspacePath(String(args.output))
  const planOutput = readFileSync(inputPath, 'utf8')
  const filtered = filterPlan(planOutput)

  writeFileSync(outputPath, filtered)
  printStatus(`Filtered plan written to ${outputPath}`)

  if (args.ci && hasOnlyNonsensicalChanges(filtered)) {
    printStatus('Only nonsensical Cloudflare Pages drift detected; exiting 0')
    process.exit(0)
  }
}

await main()
