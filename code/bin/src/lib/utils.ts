type ValidOption = {
  description: string
  name: string
  required?: boolean
  type: 'boolean' | 'string'
}

type ValidOptions = Record<string, ValidOption>

function parseArgs(options: ValidOptions) {
  const args = process.argv.slice(2)
  const result: Record<string, string | boolean> = {}

  if (args.includes('--help') || args.includes('-h')) {
    result.help = true
    return result
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg?.startsWith('--')) {
      continue
    }

    const option = options[arg]
    if (!option) {
      continue
    }

    if (option.type === 'boolean') {
      result[option.name] = true
      continue
    }

    const value = args[index + 1]
    if (value) {
      result[option.name] = value
      index += 1
    }
  }

  return result
}

function printError(message: string) {
  process.stderr.write(`${message}\n`)
}

function printStatus(message: string) {
  process.stdout.write(`${message}\n`)
}

function showHelp(
  scriptName: string,
  options: ValidOptions,
  examples: string[],
) {
  process.stdout.write(`Usage: ${scriptName} [options]\n\nOptions:\n`)
  for (const [flag, option] of Object.entries(options)) {
    process.stdout.write(
      `  ${flag}${option.required ? ' <value>' : ''}  ${option.description}\n`,
    )
  }
  process.stdout.write('\nExamples:\n')
  for (const example of examples) {
    process.stdout.write(`  ${example}\n`)
  }
}

export { parseArgs, printError, printStatus, showHelp, type ValidOptions }
