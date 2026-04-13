const SUPPORTED_EXT = new Set(['.csv', '.md', '.json', '.pdf', '.jpeg', '.jpg', '.png', '.html', '.htm'])

export function getExt(name: string) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

export function isSupportedFile(name: string) {
  return SUPPORTED_EXT.has(getExt(name))
}

export async function resolveFileHandle(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<FileSystemFileHandle> {
  const parts = relativePath.split('/')
  let dir = root
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i])
  }
  return dir.getFileHandle(parts[parts.length - 1])
}

export async function readTextFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<string> {
  const fh = await resolveFileHandle(root, relativePath)
  const file = await fh.getFile()
  return file.text()
}

export async function readBlobFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
): Promise<{ blob: Blob; type: string }> {
  const fh = await resolveFileHandle(root, relativePath)
  const file = await fh.getFile()
  return { blob: file, type: file.type }
}

export async function writeTextFile(
  root: FileSystemDirectoryHandle,
  relativePath: string,
  content: string,
): Promise<void> {
  const fh = await resolveFileHandle(root, relativePath)
  const writable = await fh.createWritable()
  await writable.write(content)
  await writable.close()
}
