import { Client4 } from '@mattermost/client';
import { Logger } from './logger';
import { FileAttachment as MoltBotFileAttachment } from './types';
import { createWriteStream, promises as fs } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  extension: string;
  url?: string;
  localPath?: string;
}

export interface DownloadedFile {
  metadata: FileMetadata;
  buffer?: Buffer;
  localPath?: string;
}

export interface UploadResult {
  fileId: string;
  metadata: FileMetadata;
}

export interface FileHandlerConfig {
  maxFileSize?: number; // in bytes, default 50MB
  downloadDir?: string; // temp directory for downloads
  allowedMimeTypes?: string[]; // empty = allow all
}

export class FileHandler {
  private readonly client: Client4;
  private readonly logger: Logger;
  private readonly config: Required<FileHandlerConfig>;

  constructor(client: Client4, logger: Logger, config: FileHandlerConfig = {}) {
    this.client = client;
    this.logger = logger;
    this.config = {
      maxFileSize: config.maxFileSize || 50 * 1024 * 1024, // 50MB default
      downloadDir: config.downloadDir || path.join(tmpdir(), 'mattermolt-files'),
      allowedMimeTypes: config.allowedMimeTypes || [],
    };

    this.ensureDownloadDir();
  }

  /**
   * Extract file metadata from MatterMost post
   */
  extractFileMetadata(post: any): FileMetadata[] {
    const fileIds = post.file_ids || [];
    const metadata = post.metadata?.files || [];

    return fileIds.map((fileId: string, index: number) => {
      const fileMeta = metadata[index] || {};
      return {
        id: fileId,
        name: fileMeta.name || `file-${fileId}`,
        size: fileMeta.size || 0,
        mimeType: fileMeta.mime_type || 'application/octet-stream',
        extension: fileMeta.extension || '',
      };
    });
  }

  /**
   * Download a file from MatterMost
   */
  async downloadFile(fileId: string): Promise<DownloadedFile> {
    this.logger.debug(`Downloading file: ${fileId}`);

    try {
      // Get file info first - using any cast for untyped Client4 methods
      const fileInfo = await (this.client as any).getFileInfo(fileId);

      const metadata: FileMetadata = {
        id: fileInfo.id,
        name: fileInfo.name,
        size: fileInfo.size,
        mimeType: fileInfo.mime_type,
        extension: fileInfo.extension,
      };

      // Validate file size
      if (metadata.size > this.config.maxFileSize) {
        throw new Error(
          `File size ${metadata.size} exceeds maximum allowed size ${this.config.maxFileSize}`
        );
      }

      // Validate MIME type if restrictions are configured
      if (
        this.config.allowedMimeTypes.length > 0 &&
        !this.config.allowedMimeTypes.includes(metadata.mimeType)
      ) {
        throw new Error(`File type ${metadata.mimeType} is not allowed`);
      }

      // Download the file - using any cast for untyped method
      const response = await (this.client as any).getFile(fileId);

      // For small files (<10MB), keep in memory
      if (metadata.size < 10 * 1024 * 1024) {
        const buffer = Buffer.from(await response.arrayBuffer());
        this.logger.info(`Downloaded file ${metadata.name} (${metadata.size} bytes) to memory`);

        return {
          metadata,
          buffer,
        };
      }

      // For large files, stream to disk
      const localPath = path.join(this.config.downloadDir, `${randomUUID()}-${metadata.name}`);

      const writeStream = createWriteStream(localPath);

      if (response.body) {
        // @ts-ignore - Node.js ReadableStream types
        await pipeline(response.body, writeStream);
      } else {
        // Fallback for non-streaming response
        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(localPath, buffer);
      }

      this.logger.info(`Downloaded file ${metadata.name} (${metadata.size} bytes) to ${localPath}`);

      return {
        metadata: { ...metadata, localPath },
        localPath,
      };
    } catch (error) {
      this.logger.error(`Failed to download file ${fileId}:`, error);
      throw error;
    }
  }

  /**
   * Download multiple files concurrently
   */
  async downloadFiles(fileIds: string[]): Promise<DownloadedFile[]> {
    if (fileIds.length === 0) return [];

    this.logger.debug(`Downloading ${fileIds.length} files`);

    const downloads = fileIds.map((fileId) => this.downloadFile(fileId));
    const results = await Promise.allSettled(downloads);

    const attachments: DownloadedFile[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        attachments.push(result.value);
      } else {
        errors.push(`File ${fileIds[index]}: ${result.reason.message}`);
      }
    });

    if (errors.length > 0) {
      this.logger.warn(`Failed to download ${errors.length} files:`, errors);
    }

    return attachments;
  }

  /**
   * Upload a file to MatterMost
   */
  async uploadFile(
    channelId: string,
    file: { path?: string; buffer?: Buffer; name: string }
  ): Promise<UploadResult> {
    this.logger.debug(`Uploading file: ${file.name} to channel ${channelId}`);

    try {
      let fileData: Buffer;

      if (file.buffer) {
        fileData = file.buffer;
      } else if (file.path) {
        fileData = await fs.readFile(file.path);
      } else {
        throw new Error('Either file.path or file.buffer must be provided');
      }

      // Validate file size
      if (fileData.length > this.config.maxFileSize) {
        throw new Error(
          `File size ${fileData.length} exceeds maximum allowed size ${this.config.maxFileSize}`
        );
      }

      // Create FormData for upload
      const formData = new FormData();
      const blob = new Blob([fileData]);
      formData.append('files', blob, file.name);
      formData.append('channel_id', channelId);

      // Upload the file - using any cast for untyped method
      const response = await (this.client as any).uploadFile(formData);

      const uploadedFile = response.file_infos[0];

      const metadata: FileMetadata = {
        id: uploadedFile.id,
        name: uploadedFile.name,
        size: uploadedFile.size,
        mimeType: uploadedFile.mime_type,
        extension: uploadedFile.extension,
      };

      this.logger.info(`Uploaded file ${file.name} (${metadata.size} bytes), ID: ${metadata.id}`);

      return {
        fileId: metadata.id,
        metadata,
      };
    } catch (error) {
      this.logger.error(`Failed to upload file ${file.name}:`, error);
      throw error;
    }
  }

  /**
   * Upload multiple files concurrently
   */
  async uploadFiles(
    channelId: string,
    files: Array<{ path?: string; buffer?: Buffer; name: string }>
  ): Promise<UploadResult[]> {
    if (files.length === 0) return [];

    this.logger.debug(`Uploading ${files.length} files to channel ${channelId}`);

    const uploads = files.map((file) => this.uploadFile(channelId, file));
    const results = await Promise.allSettled(uploads);

    const uploadResults: UploadResult[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        uploadResults.push(result.value);
      } else {
        errors.push(`File ${files[index].name}: ${result.reason.message}`);
      }
    });

    if (errors.length > 0) {
      this.logger.warn(`Failed to upload ${errors.length} files:`, errors);
    }

    return uploadResults;
  }

  /**
   * Clean up downloaded file from disk
   */
  async cleanupFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.logger.debug(`Cleaned up file: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup file ${filePath}:`, error);
    }
  }

  /**
   * Clean up multiple downloaded files
   */
  async cleanupFiles(filePaths: string[]): Promise<void> {
    await Promise.all(filePaths.map((path) => this.cleanupFile(path)));
  }

  /**
   * Get MIME type category
   */
  getMimeCategory(mimeType: string): 'image' | 'audio' | 'video' | 'document' | 'other' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (
      mimeType.startsWith('application/pdf') ||
      mimeType.startsWith('text/') ||
      mimeType.includes('document') ||
      mimeType.includes('msword') ||
      mimeType.includes('officedocument')
    ) {
      return 'document';
    }
    return 'other';
  }

  /**
   * Check if a MIME type is supported
   */
  isMimeTypeSupported(mimeType: string): boolean {
    const supportedTypes = [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Audio
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      // Video
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      // Documents
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
      'application/xml',
    ];

    return supportedTypes.includes(mimeType.toLowerCase());
  }

  /**
   * Convert downloaded file to MoltBot FileAttachment format
   */
  async toMoltBotAttachment(file: DownloadedFile): Promise<MoltBotFileAttachment> {
    let data: Buffer | string;

    if (file.buffer) {
      data = file.buffer;
    } else if (file.localPath) {
      data = await fs.readFile(file.localPath);
    } else {
      throw new Error('File has neither buffer nor localPath');
    }

    return {
      name: file.metadata.name,
      mimeType: file.metadata.mimeType,
      size: file.metadata.size,
      data,
      url: file.metadata.url,
    };
  }

  /**
   * Convert multiple downloaded files to MoltBot format
   */
  async toMoltBotAttachments(files: DownloadedFile[]): Promise<MoltBotFileAttachment[]> {
    return Promise.all(files.map((file) => this.toMoltBotAttachment(file)));
  }

  /**
   * Ensure the download directory exists
   */
  private async ensureDownloadDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.downloadDir, { recursive: true });
    } catch (error) {
      this.logger.warn(`Failed to create download directory:`, error);
    }
  }
}
