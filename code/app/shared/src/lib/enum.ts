/** UPPER_SNAKE_CASE → "Title case words" (e.g. VIBE_CODING → "Vibe coding"). */
export const enumValueToText = (value: string, separator = ' '): string => {
  if (value === '') {
    return ''
  }

  const text = value.toLowerCase().replaceAll('_', separator)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** UPPER_SNAKE_CASE → kebab-case slug (e.g. VIBE_CODING → "vibe-coding"). */
export const enumValueToSlug = (value: string): string =>
  value.toLowerCase().replaceAll('_', '-')

export const enumValuesToRecord = <T extends string>(
  values: readonly T[],
  map: (value: T) => string,
): Record<T, string> =>
  Object.fromEntries(values.map(value => [value, map(value)])) as Record<
    T,
    string
  >
