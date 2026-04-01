export const formatDateTime = (isoString?: string | Date | null): string => {
  if (!isoString) return ''

  const date = new Date(isoString)

  // Check if date is invalid
  if (isNaN(date.getTime())) return ''

  // Pad helper: 5 -> '05'
  const pad = (num: number) => num.toString().padStart(2, '0')

  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())
  const seconds = pad(date.getSeconds())

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}
