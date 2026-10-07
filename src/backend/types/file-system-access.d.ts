// Minimal File System Access API ambient types (ADR-0001 Flow B). Not yet
// part of TypeScript's bundled DOM lib. Extended in Phase 4 with directory
// handles, permission queries, and showDirectoryPicker.
export {};

declare global {
  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite';
  }

  interface FileSystemFileHandle {
    readonly kind: 'file';
    readonly name: string;
    getFile(): Promise<File>;
    queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  interface FileSystemDirectoryHandle {
    readonly kind: 'directory';
    readonly name: string;
    getDirectoryHandle(name: string): Promise<FileSystemDirectoryHandle>;
    getFileHandle(name: string): Promise<FileSystemFileHandle>;
    values(): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle>;
    queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
    requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  }

  interface OpenFilePickerOptions {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }

  interface Window {
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
    showDirectoryPicker(options?: { id?: string }): Promise<FileSystemDirectoryHandle>;
  }
}
