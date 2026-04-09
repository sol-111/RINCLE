export type FsEntry = {
  name: string
  path: string          // rootからの相対パス
  isDir: boolean
  handle: FileSystemDirectoryHandle | FileSystemFileHandle
}

export type OpenTab = {
  path: string           // rootからの相対パス
  name: string
  ext: string
}
