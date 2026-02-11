/**
 * Unit tests for MessageHandler message chunking
 */

describe('Message Chunking', () => {
  /**
   * Chunk a message into smaller pieces (extracted from MessageHandler)
   */
  function chunkMessage(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      // Try to split at a natural boundary (newline, space)
      let splitIndex = maxLength;
      const lastNewline = remaining.lastIndexOf('\n', maxLength);
      const lastSpace = remaining.lastIndexOf(' ', maxLength);

      if (lastNewline > maxLength * 0.8) {
        splitIndex = lastNewline + 1;
      } else if (lastSpace > maxLength * 0.8) {
        splitIndex = lastSpace + 1;
      }

      chunks.push(remaining.substring(0, splitIndex));
      remaining = remaining.substring(splitIndex);
    }

    return chunks;
  }

  describe('Basic Chunking', () => {
    it('should not chunk short messages', () => {
      const message = 'Hello world';
      const chunks = chunkMessage(message, 4000);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Hello world');
    });

    it('should not chunk message exactly at limit', () => {
      const message = 'a'.repeat(4000);
      const chunks = chunkMessage(message, 4000);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toHaveLength(4000);
    });

    it('should chunk message slightly over limit', () => {
      const message = 'a'.repeat(4001);
      const chunks = chunkMessage(message, 4000);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(4000);
      expect(chunks[1]).toHaveLength(1);
    });

    it('should chunk long message into multiple pieces', () => {
      const message = 'a'.repeat(10000);
      const chunks = chunkMessage(message, 4000);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toHaveLength(4000);
      expect(chunks[1]).toHaveLength(4000);
      expect(chunks[2]).toHaveLength(2000);
    });
  });

  describe('Natural Boundary Splitting', () => {
    it('should split at newline when near boundary', () => {
      const message = 'a'.repeat(3500) + '\n' + 'b'.repeat(3500);
      const chunks = chunkMessage(message, 4000);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(3501); // Includes newline
      expect(chunks[1]).toHaveLength(3500);
    });

    it('should split at space when near boundary', () => {
      const message = 'a'.repeat(3500) + ' ' + 'b'.repeat(3500);
      const chunks = chunkMessage(message, 4000);

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toHaveLength(3501); // Includes space
      expect(chunks[1]).toHaveLength(3500);
    });

    it('should prefer newline over space', () => {
      const message = 'a'.repeat(3400) + ' ' + 'b'.repeat(50) + '\n' + 'c'.repeat(3000);
      const chunks = chunkMessage(message, 4000);

      // Should split at newline (3451 chars) instead of earlier space (3401 chars)
      expect(chunks[0]).toContain('\n');
      expect(chunks[0]).toHaveLength(3452); // text + space + text + newline
    });

    it('should hard split if no natural boundary within 80% threshold', () => {
      // No space or newline in first 3200 chars (80% of 4000)
      const message = 'a'.repeat(3000) + ' ' + 'b'.repeat(5000);
      const chunks = chunkMessage(message, 4000);

      // Total message is 8001 chars, split into 3 chunks
      expect(chunks.length).toBe(3);
      expect(chunks[0]).toHaveLength(4000);
      expect(chunks.every((chunk) => chunk.length <= 4000)).toBe(true);
    });
  });

  describe('MatterMost Spec Compliance', () => {
    it('should chunk at 4000 character limit', () => {
      const message = 'x'.repeat(8500);
      const chunks = chunkMessage(message, 4000);

      expect(chunks).toHaveLength(3);
      expect(chunks.every((chunk) => chunk.length <= 4000)).toBe(true);
    });

    it('should preserve all content across chunks', () => {
      const message = 'Test message ' + 'x'.repeat(5000) + ' end';
      const chunks = chunkMessage(message, 4000);

      const reconstructed = chunks.join('');
      expect(reconstructed).toBe(message);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty message', () => {
      const chunks = chunkMessage('', 4000);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('');
    });

    it('should handle message with only newlines', () => {
      const message = '\n'.repeat(5000);
      const chunks = chunkMessage(message, 4000);

      expect(chunks.length).toBeGreaterThan(1);
      const reconstructed = chunks.join('');
      expect(reconstructed).toBe(message);
    });

    it('should handle message with only spaces', () => {
      const message = ' '.repeat(5000);
      const chunks = chunkMessage(message, 4000);

      expect(chunks.length).toBeGreaterThan(1);
      const reconstructed = chunks.join('');
      expect(reconstructed).toBe(message);
    });

    it('should handle very small chunk size', () => {
      const message = 'Hello World Test Message';
      const chunks = chunkMessage(message, 10);

      expect(chunks.length).toBeGreaterThan(1);
      const reconstructed = chunks.join('');
      expect(reconstructed).toBe(message);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle multi-paragraph message', () => {
      const message = 'Paragraph 1\\n\\n' + 'x'.repeat(2000) + '\\n\\nParagraph 2\\n\\n' + 'y'.repeat(2000);
      const chunks = chunkMessage(message, 4000);

      expect(chunks.length).toBeGreaterThan(1);
      const reconstructed = chunks.join('');
      expect(reconstructed.length).toBe(message.length);
    });

    it('should handle code blocks', () => {
      const codeBlock = '```\\n' + 'code line\\n'.repeat(300) + '```';
      const chunks = chunkMessage(codeBlock, 4000);

      const reconstructed = chunks.join('');
      expect(reconstructed).toBe(codeBlock);
    });

    it('should handle markdown formatted text', () => {
      const markdown =
        '# Title\\n\\n' +
        '## Subtitle\\n\\n' +
        'Some text with **bold** and *italic*.\\n\\n' +
        '- List item 1\\n' +
        '- List item 2\\n\\n' +
        'x'.repeat(5000);

      const chunks = chunkMessage(markdown, 4000);
      const reconstructed = chunks.join('');
      expect(reconstructed).toBe(markdown);
    });
  });
});
