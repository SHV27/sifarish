/** Save bytes as a file download. Files end here — there is no Send (I3). */
export function saveFile(data: Uint8Array | Blob, filename: string, mime: string) {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
