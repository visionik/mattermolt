import { FileHandler, DownloadedFile } from '../../src/file-handler';
import { Logger } from '../../src/logger';
import { Client4 } from '@mattermost/client';

// Mock dependencies
jest.mock('@mattermost/client');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
  },
  createWriteStream: jest.fn(),
}));

describe('FileHandler', () => {
  let fileHandler: FileHandler;
  let mockClient: any;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    mockClient = {
      getFileInfo: jest.fn(),
      getFile: jest.fn(),
      uploadFile: jest.fn(),
    };
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<Logger>;

    fileHandler = new FileHandler(mockClient as Client4, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extractFileMetadata', () => {
    it('should extract file metadata from post', () => {
      const post = {
        file_ids: ['file1', 'file2'],
        metadata: {
          files: [
            {
              name: 'image.png',
              size: 1024,
              mime_type: 'image/png',
              extension: 'png',
            },
            {
              name: 'document.pdf',
              size: 2048,
              mime_type: 'application/pdf',
              extension: 'pdf',
            },
          ],
        },
      };

      const metadata = fileHandler.extractFileMetadata(post);

      expect(metadata).toHaveLength(2);
      expect(metadata[0]).toEqual({
        id: 'file1',
        name: 'image.png',
        size: 1024,
        mimeType: 'image/png',
        extension: 'png',
      });
      expect(metadata[1]).toEqual({
        id: 'file2',
        name: 'document.pdf',
        size: 2048,
        mimeType: 'application/pdf',
        extension: 'pdf',
      });
    });

    it('should handle posts with no files', () => {
      const post = {};
      const metadata = fileHandler.extractFileMetadata(post);
      expect(metadata).toEqual([]);
    });

    it('should handle missing metadata', () => {
      const post = {
        file_ids: ['file1'],
        metadata: {},
      };

      const metadata = fileHandler.extractFileMetadata(post);

      expect(metadata).toHaveLength(1);
      expect(metadata[0]).toEqual({
        id: 'file1',
        name: 'file-file1',
        size: 0,
        mimeType: 'application/octet-stream',
        extension: '',
      });
    });
  });

  describe('downloadFile', () => {
    it('should download small file to memory', async () => {
      const fileInfo = {
        id: 'file1',
        name: 'small.txt',
        size: 1024,
        mime_type: 'text/plain',
        extension: 'txt',
      };

      const fileContent = Buffer.from('Hello, World!');

      mockClient.getFileInfo = jest.fn().mockResolvedValue(fileInfo);
      mockClient.getFile = jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(fileContent.buffer),
      });

      const result = await fileHandler.downloadFile('file1');

      expect(result.metadata.name).toBe('small.txt');
      expect(result.buffer).toBeDefined();
      expect(result.localPath).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Downloaded file small.txt')
      );
    });

    it('should reject files exceeding size limit', async () => {
      const fileInfo = {
        id: 'file1',
        name: 'huge.bin',
        size: 100 * 1024 * 1024, // 100MB
        mime_type: 'application/octet-stream',
        extension: 'bin',
      };

      mockClient.getFileInfo = jest.fn().mockResolvedValue(fileInfo);

      await expect(fileHandler.downloadFile('file1')).rejects.toThrow(
        'exceeds maximum allowed size'
      );
    });

    it('should reject files with disallowed MIME types', async () => {
      const restrictedHandler = new FileHandler(mockClient, mockLogger, {
        allowedMimeTypes: ['image/png', 'image/jpeg'],
      });

      const fileInfo = {
        id: 'file1',
        name: 'doc.pdf',
        size: 1024,
        mime_type: 'application/pdf',
        extension: 'pdf',
      };

      mockClient.getFileInfo = jest.fn().mockResolvedValue(fileInfo);

      await expect(restrictedHandler.downloadFile('file1')).rejects.toThrow(
        'is not allowed'
      );
    });

    it('should handle download errors', async () => {
      mockClient.getFileInfo = jest.fn().mockRejectedValue(new Error('API Error'));

      await expect(fileHandler.downloadFile('file1')).rejects.toThrow('API Error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download file'),
        expect.any(Error)
      );
    });
  });

  describe('downloadFiles', () => {
    it('should download multiple files concurrently', async () => {
      const fileInfo1 = {
        id: 'file1',
        name: 'file1.txt',
        size: 100,
        mime_type: 'text/plain',
        extension: 'txt',
      };

      const fileInfo2 = {
        id: 'file2',
        name: 'file2.txt',
        size: 200,
        mime_type: 'text/plain',
        extension: 'txt',
      };

      mockClient.getFileInfo = jest
        .fn()
        .mockResolvedValueOnce(fileInfo1)
        .mockResolvedValueOnce(fileInfo2);

      mockClient.getFile = jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('content').buffer),
      });

      const results = await fileHandler.downloadFiles(['file1', 'file2']);

      expect(results).toHaveLength(2);
      expect(results[0].metadata.name).toBe('file1.txt');
      expect(results[1].metadata.name).toBe('file2.txt');
    });

    it('should handle partial failures', async () => {
      mockClient.getFileInfo = jest
        .fn()
        .mockResolvedValueOnce({
          id: 'file1',
          name: 'good.txt',
          size: 100,
          mime_type: 'text/plain',
          extension: 'txt',
        })
        .mockRejectedValueOnce(new Error('Not found'));

      mockClient.getFile = jest.fn().mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(Buffer.from('content').buffer),
      });

      const results = await fileHandler.downloadFiles(['file1', 'file2']);

      expect(results).toHaveLength(1);
      expect(results[0].metadata.name).toBe('good.txt');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download'),
        expect.any(Array)
      );
    });

    it('should return empty array for no files', async () => {
      const results = await fileHandler.downloadFiles([]);
      expect(results).toEqual([]);
    });
  });

  describe('uploadFile', () => {
    it('should upload file from buffer', async () => {
      const fileData = Buffer.from('test content');
      const uploadResponse = {
        file_infos: [
          {
            id: 'uploaded1',
            name: 'test.txt',
            size: fileData.length,
            mime_type: 'text/plain',
            extension: 'txt',
          },
        ],
      };

      mockClient.uploadFile = jest.fn().mockResolvedValue(uploadResponse);

      const result = await fileHandler.uploadFile('channel1', {
        buffer: fileData,
        name: 'test.txt',
      });

      expect(result.fileId).toBe('uploaded1');
      expect(result.metadata.name).toBe('test.txt');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Uploaded file test.txt')
      );
    });

    it('should reject upload without path or buffer', async () => {
      await expect(
        fileHandler.uploadFile('channel1', { name: 'test.txt' })
      ).rejects.toThrow('Either file.path or file.buffer must be provided');
    });

    it('should reject files exceeding size limit', async () => {
      const largeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB

      await expect(
        fileHandler.uploadFile('channel1', {
          buffer: largeBuffer,
          name: 'huge.bin',
        })
      ).rejects.toThrow('exceeds maximum allowed size');
    });

    it('should handle upload errors', async () => {
      mockClient.uploadFile = jest.fn().mockRejectedValue(new Error('Upload failed'));

      await expect(
        fileHandler.uploadFile('channel1', {
          buffer: Buffer.from('test'),
          name: 'test.txt',
        })
      ).rejects.toThrow('Upload failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to upload file'),
        expect.any(Error)
      );
    });
  });

  describe('uploadFiles', () => {
    it('should upload multiple files concurrently', async () => {
      const uploadResponse = (name: string, id: string) => ({
        file_infos: [
          {
            id,
            name,
            size: 100,
            mime_type: 'text/plain',
            extension: 'txt',
          },
        ],
      });

      mockClient.uploadFile = jest
        .fn()
        .mockResolvedValueOnce(uploadResponse('file1.txt', 'id1'))
        .mockResolvedValueOnce(uploadResponse('file2.txt', 'id2'));

      const results = await fileHandler.uploadFiles('channel1', [
        { buffer: Buffer.from('content1'), name: 'file1.txt' },
        { buffer: Buffer.from('content2'), name: 'file2.txt' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].fileId).toBe('id1');
      expect(results[1].fileId).toBe('id2');
    });

    it('should handle partial failures', async () => {
      mockClient.uploadFile = jest
        .fn()
        .mockResolvedValueOnce({
          file_infos: [
            {
              id: 'id1',
              name: 'file1.txt',
              size: 100,
              mime_type: 'text/plain',
              extension: 'txt',
            },
          ],
        })
        .mockRejectedValueOnce(new Error('Upload failed'));

      const results = await fileHandler.uploadFiles('channel1', [
        { buffer: Buffer.from('content1'), name: 'file1.txt' },
        { buffer: Buffer.from('content2'), name: 'file2.txt' },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0].fileId).toBe('id1');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to upload'),
        expect.any(Array)
      );
    });

    it('should return empty array for no files', async () => {
      const results = await fileHandler.uploadFiles('channel1', []);
      expect(results).toEqual([]);
    });
  });

  describe('getMimeCategory', () => {
    it('should categorize images', () => {
      expect(fileHandler.getMimeCategory('image/png')).toBe('image');
      expect(fileHandler.getMimeCategory('image/jpeg')).toBe('image');
      expect(fileHandler.getMimeCategory('image/gif')).toBe('image');
    });

    it('should categorize audio', () => {
      expect(fileHandler.getMimeCategory('audio/mpeg')).toBe('audio');
      expect(fileHandler.getMimeCategory('audio/wav')).toBe('audio');
    });

    it('should categorize video', () => {
      expect(fileHandler.getMimeCategory('video/mp4')).toBe('video');
      expect(fileHandler.getMimeCategory('video/webm')).toBe('video');
    });

    it('should categorize documents', () => {
      expect(fileHandler.getMimeCategory('application/pdf')).toBe('document');
      expect(fileHandler.getMimeCategory('text/plain')).toBe('document');
      expect(fileHandler.getMimeCategory('text/markdown')).toBe('document');
    });

    it('should return other for unknown types', () => {
      expect(fileHandler.getMimeCategory('application/octet-stream')).toBe('other');
    });
  });

  describe('isMimeTypeSupported', () => {
    it('should support common image types', () => {
      expect(fileHandler.isMimeTypeSupported('image/jpeg')).toBe(true);
      expect(fileHandler.isMimeTypeSupported('image/png')).toBe(true);
      expect(fileHandler.isMimeTypeSupported('image/gif')).toBe(true);
      expect(fileHandler.isMimeTypeSupported('image/webp')).toBe(true);
    });

    it('should support common audio types', () => {
      expect(fileHandler.isMimeTypeSupported('audio/mpeg')).toBe(true);
      expect(fileHandler.isMimeTypeSupported('audio/wav')).toBe(true);
      expect(fileHandler.isMimeTypeSupported('audio/ogg')).toBe(true);
    });

    it('should support common video types', () => {
      expect(fileHandler.isMimeTypeSupported('video/mp4')).toBe(true);
      expect(fileHandler.isMimeTypeSupported('video/webm')).toBe(true);
    });

    it('should support common document types', () => {
      expect(fileHandler.isMimeTypeSupported('application/pdf')).toBe(true);
      expect(fileHandler.isMimeTypeSupported('text/plain')).toBe(true);
      expect(fileHandler.isMimeTypeSupported('text/markdown')).toBe(true);
    });

    it('should not support unsupported types', () => {
      expect(fileHandler.isMimeTypeSupported('application/x-custom')).toBe(false);
      expect(fileHandler.isMimeTypeSupported('unknown/type')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(fileHandler.isMimeTypeSupported('IMAGE/PNG')).toBe(true);
      expect(fileHandler.isMimeTypeSupported('Audio/MPEG')).toBe(true);
    });
  });

  describe('toMoltBotAttachment', () => {
    it('should convert file with buffer', async () => {
      const buffer = Buffer.from('test content');
      const downloadedFile: DownloadedFile = {
        metadata: {
          id: 'file1',
          name: 'test.txt',
          size: buffer.length,
          mimeType: 'text/plain',
          extension: 'txt',
        },
        buffer,
      };

      const attachment = await fileHandler.toMoltBotAttachment(downloadedFile);

      expect(attachment.name).toBe('test.txt');
      expect(attachment.mimeType).toBe('text/plain');
      expect(attachment.size).toBe(buffer.length);
      expect(attachment.data).toBe(buffer);
    });

    it('should throw for file with neither buffer nor localPath', async () => {
      const downloadedFile: DownloadedFile = {
        metadata: {
          id: 'file1',
          name: 'test.txt',
          size: 100,
          mimeType: 'text/plain',
          extension: 'txt',
        },
      };

      await expect(fileHandler.toMoltBotAttachment(downloadedFile)).rejects.toThrow(
        'neither buffer nor localPath'
      );
    });
  });

  describe('cleanupFile', () => {
    it('should delete file from disk', async () => {
      const fs = require('fs').promises;
      fs.unlink.mockResolvedValue(undefined);

      await fileHandler.cleanupFile('/tmp/test.txt');

      expect(fs.unlink).toHaveBeenCalledWith('/tmp/test.txt');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Cleaned up file')
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const fs = require('fs').promises;
      fs.unlink.mockRejectedValue(new Error('Permission denied'));

      await fileHandler.cleanupFile('/tmp/test.txt');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cleanup'),
        expect.any(Error)
      );
    });
  });

  describe('cleanupFiles', () => {
    it('should cleanup multiple files', async () => {
      const fs = require('fs').promises;
      fs.unlink.mockResolvedValue(undefined);

      await fileHandler.cleanupFiles(['/tmp/file1.txt', '/tmp/file2.txt']);

      expect(fs.unlink).toHaveBeenCalledTimes(2);
    });
  });
});
