export interface SourceFile {
  id: string
  name: string
  path: string
  data: Uint8Array
  pageCount: number
}

export interface PageItem {
  id: string
  sourceFileId: string
  sourceFileName: string
  pageIndex: number  // 0始まり
  rotation: number   // 追加回転量: 0 | 90 | 180 | 270
  thumbnail: string | null  // base64 data URL。null = 生成中
}

export interface FileData {
  path: string
  name: string
  data: ArrayBuffer
}

export interface ImageFileData extends FileData {
  type: 'image/png' | 'image/jpeg'
}

// preload で公開する API の型
declare global {
  interface Window {
    electronAPI: {
      openFiles: () => Promise<FileData[]>
      readFiles: (filePaths: string[]) => Promise<FileData[]>
      saveFile: (defaultName: string) => Promise<string | null>
      writeFile: (filePath: string, data: ArrayBuffer) => Promise<void>
      selectFolder: () => Promise<string | null>
      writeToPath: (filePath: string, data: ArrayBuffer) => Promise<void>
      openImages: () => Promise<ImageFileData[]>
    }
  }
}
