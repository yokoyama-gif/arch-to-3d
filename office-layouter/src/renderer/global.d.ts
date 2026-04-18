declare global {
  interface Window {
    officeApi?: {
      saveProject: (payload: string) => Promise<{
        canceled: boolean;
        filePath?: string;
      }>;
      loadProject: () => Promise<{
        canceled: boolean;
        filePath?: string;
        content?: string;
      }>;
      saveTextFile: (payload: {
        defaultPath: string;
        content: string;
        filters?: { name: string; extensions: string[] }[];
      }) => Promise<{
        canceled: boolean;
        filePath?: string;
      }>;
      saveBinaryFile: (payload: {
        defaultPath: string;
        bytes: number[];
        filters?: { name: string; extensions: string[] }[];
      }) => Promise<{
        canceled: boolean;
        filePath?: string;
      }>;
      exportPdf: (payload: {
        defaultPath: string;
        html: string;
      }) => Promise<{
        canceled: boolean;
        filePath?: string;
      }>;
    };
  }
}

export {};
