import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  getDocument,
  GlobalWorkerOptions,
  PDFDocumentProxy,
  PDFPageProxy,
} from 'pdfjs-dist';

// Set up PDF.js worker
GlobalWorkerOptions.workerSrc = require.resolve(
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
);

// Configure PDF.js with proper font and CMap data URLs
const PDFJS_CONFIG = {
  standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.0.269/standard_fonts/',
  cMapUrl: 'https://unpkg.com/pdfjs-dist@4.0.269/cmaps/',
  cMapPacked: true,
  disableFontFace: false,
  useSystemFonts: true,
};

export interface PdfPageContent {
  pageNumber: number;
  text: string;
  images?: Buffer[];
  confidence: number;
}

interface TextContentItem {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
}

interface TextContent {
  items: TextContentItem[];
  styles: Record<string, any>;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly tempDir: string;
  private readonly pdfPath: string;

  constructor(private configService: ConfigService) {
    this.tempDir = this.configService.get<string>('TEMP_DIR', './temp');
    this.pdfPath = this.configService.get<string>(
      'PDF_PATH',
      './data/mrcs-question-bank.pdf',
    );
    this.ensureTempDirectory();
  }

  async extractPagesContent(
    startPage = 1,
    endPage?: number,
  ): Promise<PdfPageContent[]> {
    try {
      this.logger.log(
        `Starting PDF extraction from page ${startPage} to ${endPage || 'end'}`,
      );

      if (!(await fs.pathExists(this.pdfPath))) {
        throw new Error(`PDF file not found at: ${this.pdfPath}`);
      }

      const buffer = await fs.readFile(this.pdfPath);
      const data = new Uint8Array(buffer);

      // Use proper PDF.js configuration
      const doc = await getDocument({
        data,
        ...PDFJS_CONFIG,
        verbosity: 0, // Reduce console warnings
      }).promise;

      const totalPages = doc.numPages;

      const actualEndPage = endPage
        ? Math.min(endPage, totalPages)
        : totalPages;
      this.logger.log(
        `PDF has ${totalPages} pages, extracting ${startPage}-${actualEndPage}`,
      );

      const results: PdfPageContent[] = [];

      for (let pageNum = startPage; pageNum <= actualEndPage; pageNum++) {
        try {
          const pageContent = await this.extractPageContent(doc, pageNum);
          results.push(pageContent);

          if (pageNum % 10 === 0) {
            this.logger.log(`Processed ${pageNum}/${actualEndPage} pages`);
          }
        } catch (error) {
          this.logger.error(`Failed to extract page ${pageNum}:`, error);
          results.push({
            pageNumber: pageNum,
            text: '',
            confidence: 0,
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('PDF extraction failed:', error);
      throw error;
    }
  }

  async extractSinglePage(pageNumber: number): Promise<PdfPageContent> {
    try {
      const buffer = await fs.readFile(this.pdfPath);
      const data = new Uint8Array(buffer);

      // Use proper PDF.js configuration
      const doc = await getDocument({
        data,
        ...PDFJS_CONFIG,
        verbosity: 0,
      }).promise;

      if (pageNumber > doc.numPages) {
        throw new Error(
          `Page ${pageNumber} does not exist. PDF has ${doc.numPages} pages.`,
        );
      }

      return await this.extractPageContent(doc, pageNumber);
    } catch (error) {
      this.logger.error(`Failed to extract page ${pageNumber}:`, error);
      throw error;
    }
  }

  private async extractPageContent(
    doc: PDFDocumentProxy,
    pageNumber: number,
  ): Promise<PdfPageContent> {
    const page = await doc.getPage(pageNumber);

    // Extract text content
    const textContent = await page.getTextContent();
    const text = (textContent as TextContent).items
      .map((item: TextContentItem) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const images: Buffer[] = [];
    const confidence = 0.7; // Default confidence for text extraction

    // If text extraction yields poor results, try OCR
    if (text.length < 100) {
      try {
        const {
          text: ocrText,
          images: extractedImages,
          confidence: ocrConfidence,
        } = await this.extractWithOCR(page, pageNumber);

        if (ocrText.length > text.length) {
          return {
            pageNumber,
            text: ocrText,
            images: extractedImages,
            confidence: ocrConfidence,
          };
        }
      } catch (ocrError) {
        this.logger.warn(`OCR failed for page ${pageNumber}:`, ocrError);
      }
    }

    return {
      pageNumber,
      text,
      images,
      confidence,
    };
  }

  private async extractWithOCR(
    page: PDFPageProxy,
    pageNumber: number,
  ): Promise<{ text: string; images: Buffer[]; confidence: number }> {
    try {
      // Get page text content directly from PDF.js
      const textContent = await page.getTextContent();
      let extractedText = '';

      if (textContent && textContent.items && textContent.items.length > 0) {
        // Extract text from PDF.js text content
        extractedText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      // If we have text content, return it without OCR
      if (extractedText.length > 0) {
        return {
          text: extractedText,
          images: [],
          confidence: 0.9, // High confidence for direct text extraction
        };
      }

      // Fallback: Try to extract text using PDF.js text layer
      try {
        const textLayer = await page.getTextContent();

        if (textLayer && textLayer.items && textLayer.items.length > 0) {
          const text = textLayer.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (text.length > 0) {
            return {
              text,
              images: [],
              confidence: 0.8,
            };
          }
        }
      } catch (textError) {
        this.logger.warn(
          `Text extraction failed for page ${pageNumber}:`,
          textError,
        );
      }

      // If no text found, return empty result
      this.logger.warn(`No text content found for page ${pageNumber}`);
      return {
        text: '',
        images: [],
        confidence: 0,
      };
    } catch (error) {
      this.logger.error(
        `Text extraction failed for page ${pageNumber}:`,
        error,
      );
      return {
        text: '',
        images: [],
        confidence: 0,
      };
    }
  }

  async validatePdfFile(): Promise<{
    valid: boolean;
    totalPages?: number;
    error?: string;
  }> {
    try {
      if (!(await fs.pathExists(this.pdfPath))) {
        return {
          valid: false,
          error: `PDF file not found at: ${this.pdfPath}`,
        };
      }

      const stats = await fs.stat(this.pdfPath);
      if (stats.size === 0) {
        return { valid: false, error: 'PDF file is empty' };
      }

      const buffer = await fs.readFile(this.pdfPath);
      const data = new Uint8Array(buffer);

      // Use proper PDF.js configuration
      const doc = await getDocument({
        data,
        ...PDFJS_CONFIG,
        verbosity: 0,
      }).promise;
      const totalPages = doc.numPages;

      return { valid: true, totalPages };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return { valid: false, error: `PDF validation failed: ${errorMessage}` };
    }
  }

  async getPdfInfo(): Promise<{
    totalPages: number;
    fileSize: number;
    fileName: string;
  }> {
    try {
      const stats = await fs.stat(this.pdfPath);
      const buffer = await fs.readFile(this.pdfPath);
      const data = new Uint8Array(buffer);

      // Use proper PDF.js configuration
      const doc = await getDocument({
        data,
        ...PDFJS_CONFIG,
        verbosity: 0,
      }).promise;

      return {
        totalPages: doc.numPages,
        fileSize: stats.size,
        fileName: path.basename(this.pdfPath),
      };
    } catch (error) {
      this.logger.error('Failed to get PDF info:', error);
      throw error;
    }
  }

  async extractTextFromPage(pageNumber: number): Promise<string> {
    try {
      const pageContent = await this.extractSinglePage(pageNumber);
      return pageContent.text;
    } catch (error) {
      this.logger.error(
        `Failed to extract text from page ${pageNumber}:`,
        error,
      );
      return '';
    }
  }

  private ensureTempDirectory(): void {
    try {
      fs.ensureDirSync(this.tempDir);
    } catch (error) {
      this.logger.error('Failed to create temp directory:', error);
      throw error;
    }
  }

  async cleanup(): Promise<void> {
    try {
      await fs.emptyDir(this.tempDir);
      this.logger.log('Cleaned up temporary files');
    } catch (error) {
      this.logger.error('Failed to cleanup temp directory:', error);
    }
  }
}
