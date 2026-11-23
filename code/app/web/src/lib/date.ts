const dateFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
  year: 'numeric',
})

export const formatDate = (date: Date) => dateFormatter.format(date)

export const toISODate = (date: Date) => date.toISOString().slice(0, 10)
