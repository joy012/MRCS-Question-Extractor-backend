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

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly tempDir: string;
  private readonly dataDir: string;
  private currentPdfPath: string | null = null;

  constructor(private configService: ConfigService) {
    this.tempDir = this.configService.get<string>('TEMP_DIR', './temp');
    this.dataDir = this.configService.get<string>('DATA_DIR', './data');
    this.ensureTempDirectory();
  }

  /**
   * Set the current PDF to work with
   * @param pdfFilename The PDF filename (e.g., 'mrcs-questions.pdf')
   */
  setCurrentPdf(pdfFilename: string): void {
    this.currentPdfPath = path.join(this.dataDir, pdfFilename);
    this.logger.log(`Set current PDF to: ${this.currentPdfPath}`);
  }

  /**
   * Get the current PDF path
   * @returns The current PDF path
   */
  getCurrentPdfPath(): string {
    if (!this.currentPdfPath) {
      throw new Error('No PDF has been set. Call setCurrentPdf() first.');
    }
    return this.currentPdfPath;
  }

  /**
   * Validate if the current PDF exists and is accessible
   */
  async validateCurrentPdf(): Promise<{
    valid: boolean;
    totalPages?: number;
    error?: string;
  }> {
    try {
      const pdfPath = this.getCurrentPdfPath();

      if (!(await fs.pathExists(pdfPath))) {
        return {
          valid: false,
          error: `PDF file not found at: ${pdfPath}`,
        };
      }

      const stats = await fs.stat(pdfPath);
      if (stats.size === 0) {
        return { valid: false, error: 'PDF file is empty' };
      }

      const buffer = await fs.readFile(pdfPath);
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

  async extractPagesContent(
    startPage = 1,
    endPage?: number,
  ): Promise<PdfPageContent[]> {
    try {
      this.logger.log(
        `Starting PDF extraction from page ${startPage} to ${endPage || 'end'}`,
      );

      const pdfPath = this.getCurrentPdfPath();

      if (!(await fs.pathExists(pdfPath))) {
        throw new Error(`PDF file not found at: ${pdfPath}`);
      }

      const buffer = await fs.readFile(pdfPath);
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
      const pdfPath = this.getCurrentPdfPath();
      const buffer = await fs.readFile(pdfPath);
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

    // Try multiple text extraction methods
    let bestText = '';
    let bestConfidence = 0;
    const images: Buffer[] = [];

    // Method 1: Standard text content extraction
    try {
      const textContent = await page.getTextContent();
      if (textContent && textContent.items && textContent.items.length > 0) {
        const text = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text.length > bestText.length) {
          bestText = text;
          bestConfidence = 0.8;
        }
      }
    } catch (error) {
      this.logger.warn(
        `Standard text extraction failed for page ${pageNumber}:`,
        error,
      );
    }

    // Method 2: Try with different text extraction parameters
    if (bestText.length < 100) {
      try {
        const textContentAlt = await page.getTextContent();
        if (
          textContentAlt &&
          textContentAlt.items &&
          textContentAlt.items.length > 0
        ) {
          const text = textContentAlt.items
            .map((item: any) => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (text.length > bestText.length) {
            bestText = text;
            bestConfidence = 0.7;
          }
        }
      } catch (error) {
        this.logger.warn(
          `Alternative text extraction failed for page ${pageNumber}:`,
          error,
        );
      }
    }

    // Method 3: Try to extract text using page operations
    if (bestText.length < 50) {
      try {
        const opList = await page.getOperatorList();
        if (opList && opList.fnArray) {
          let text = '';
          for (let i = 0; i < opList.fnArray.length; i++) {
            if (opList.fnArray[i] === 17) {
              // PDFJS.OPS.showText
              const args = opList.argsArray[i];
              if (args && args.length > 0) {
                text += args.join(' ');
              }
            }
          }

          if (text.trim().length > bestText.length) {
            bestText = text.trim();
            bestConfidence = 0.6;
          }
        }
      } catch (error) {
        this.logger.warn(
          `Operator list extraction failed for page ${pageNumber}:`,
          error,
        );
      }
    }

    // If still no text found, log the issue
    if (bestText.length === 0) {
      this.logger.warn(
        `No text content found for page ${pageNumber} - PDF may be image-based or corrupted`,
      );
    }

    return {
      pageNumber,
      text: bestText,
      images,
      confidence: bestConfidence,
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

  async getPdfInfo(): Promise<{
    totalPages: number;
    fileSize: number;
    fileName: string;
  }> {
    try {
      const pdfPath = this.getCurrentPdfPath();
      const stats = await fs.stat(pdfPath);
      const buffer = await fs.readFile(pdfPath);
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
        fileName: path.basename(pdfPath),
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
