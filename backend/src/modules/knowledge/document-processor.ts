import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { DocumentType } from '@prisma/client';
import { logger } from '../../core/logger';

export async function extractDocumentText(
  buffer: Buffer,
  docType: DocumentType
): Promise<string> {
  switch (docType) {
    case 'PDF': {
      const parsed = await pdfParse(buffer);
      return parsed.text;
    }
    case 'DOCX': {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case 'TXT':
    case 'MARKDOWN':
      return buffer.toString('utf-8');
    case 'CSV':
      return buffer.toString('utf-8');
    case 'XLSX':
      return buffer.toString('utf-8');
    default:
      return '';
  }
}

export async function processDocumentContent(
  buffer: Buffer,
  docType: DocumentType
): Promise<{ content: string; status: 'INDEXED' | 'FAILED' }> {
  try {
    const text = await extractDocumentText(buffer, docType);
    const trimmed = text.trim();
    if (!trimmed) {
      return { content: '', status: 'FAILED' };
    }
    return { content: trimmed.slice(0, 50000), status: 'INDEXED' };
  } catch (error) {
    logger.error('Document text extraction failed:', error);
    return { content: '', status: 'FAILED' };
  }
}
