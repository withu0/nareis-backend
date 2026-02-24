declare module 'multer' {
  export interface File {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    size: number;
    destination: string;
    filename: string;
    path: string;
    buffer: Buffer;
  }

  export interface FileFilterCallback {
    (error: Error | null, acceptFile: boolean): void;
  }

  export interface Options {
    dest?: string;
    storage?: any;
    fileFilter?: (req: any, file: File, cb: FileFilterCallback) => void;
    limits?: {
      fieldNameSize?: number;
      fieldSize?: number;
      fields?: number;
      fileSize?: number;
      files?: number;
      headerPairs?: number;
    };
  }

  export interface Multer {
    (options?: Options): any;
    diskStorage(options: any): any;
    memoryStorage(): any;
  }

  const multer: Multer;
  export default multer;
}

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      }
    }
  }
}

export {};
