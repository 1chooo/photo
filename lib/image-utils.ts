export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  return (bytes / (1024 * 1024)).toFixed(2) + " MB"
}

export function calculateSavings(original: number, compressed: number): string {
  const savings = ((original - compressed) / original) * 100
  return savings.toFixed(1)
}
