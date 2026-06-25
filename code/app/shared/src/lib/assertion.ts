export const isDefined = <T>(value: T | null | undefined): value is T =>
  value !== null && value !== undefined

export const assertNotNil = <T>(
  value: T | null | undefined,
  message = 'Expected value to be defined',
): NonNullable<T> => {
  if (value === null || value === undefined) {
    throw new Error(message)
  }

  return value
}
