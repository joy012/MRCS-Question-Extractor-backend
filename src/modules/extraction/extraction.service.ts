import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Question, QuestionStatus } from '@prisma/client';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { QuestionsService } from '../questions/questions.service';
import { ExtractedQuestion, OllamaService } from './ollama.service';
import { PdfService } from './pdf.service';

export interface ExtractionState {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  selectedPdf: string;
  progress: number;
  totalPages: number;
  processedPages: number;
  failedPages: number[];
  logs: string[];
  startTime?: Date;
  endTime?: Date;
  error?: string;
  extractedQuestions: number;
  questionsPerPage: Record<number, number>;
  verifiedQuestions: number;
  updatedQuestions: number;
  skippedQuestions: number;
}

export interface ExtractionEvent {
  type: 'start' | 'progress' | 'complete' | 'error' | 'stop';
  data: any;
  timestamp: Date;
}

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private extractionState: ExtractionState = {
    status: 'idle',
    selectedPdf: '',
    progress: 0,
    totalPages: 0,
    processedPages: 0,
    failedPages: [],
    logs: [],
    extractedQuestions: 0,
    questionsPerPage: {},
    verifiedQuestions: 0,
    updatedQuestions: 0,
    skippedQuestions: 0,
  };
  private isStopping = false;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly ollamaService: OllamaService,
    private readonly pdfService: PdfService,
    private readonly questionsService: QuestionsService,
  ) {}

  // List all PDFs in the data folder
  async listPdfs(): Promise<string[]> {
    const dataDir = join(process.cwd(), 'data');
    const files = await readdir(dataDir);
    return files.filter((f) => f.toLowerCase().endsWith('.pdf'));
  }

  // Start extraction for a selected PDF (non-blocking)
  startExtraction(pdf: string): { message: string; extractionId: string } {
    if (this.extractionState.status === 'processing') {
      throw new BadRequestException('Extraction already in progress');
    }

    // Reset state
    this.extractionState = {
      status: 'processing',
      selectedPdf: pdf,
      progress: 0,
      totalPages: 0, // Will be set when we get PDF info
      processedPages: 0,
      failedPages: [],
      logs: [`[${new Date().toISOString()}] Starting extraction for ${pdf}`],
      startTime: new Date(),
      extractedQuestions: 0,
      questionsPerPage: {},
      verifiedQuestions: 0,
      updatedQuestions: 0,
      skippedQuestions: 0,
    };

    this.isStopping = false;
    this.logger.log(`Starting extraction for ${pdf}`);

    // Start background processing
    this.startBackgroundExtraction(pdf);

    // Emit start event
    this.eventEmitter.emit('extraction.started', {
      pdf,
      timestamp: new Date(),
    });

    return {
      message: `Extraction started for ${pdf}`,
      extractionId: `extraction_${Date.now()}`,
    };
  }

  // Background extraction process
  private async startBackgroundExtraction(pdf: string) {
    try {
      // Get PDF information
      const pdfInfo = await this.pdfService.getPdfInfo();
      this.extractionState.totalPages = pdfInfo.totalPages;
      this.extractionState.logs.push(
        `[${new Date().toISOString()}] PDF loaded: ${pdfInfo.totalPages} pages`,
      );

      // Process pages sequentially
      for (let pageNumber = 1; pageNumber <= pdfInfo.totalPages; pageNumber++) {
        if (this.isStopping) {
          this.handleExtractionStop();
          return;
        }

        await this.processPage(pageNumber, pdf);
      }

      this.handleExtractionComplete();
    } catch (error) {
      this.extractionState.status = 'failed';
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.extractionState.error = errorMessage;
      this.extractionState.logs.push(
        `[${new Date().toISOString()}] Failed to start extraction: ${errorMessage}`,
      );
      this.logger.error('Failed to start extraction:', error);
    }
  }

  // Process a single page
  private async processPage(pageNumber: number, pdf: string) {
    if (this.isStopping) {
      this.handleExtractionStop();
      return;
    }

    try {
      this.extractionState.logs.push(
        `[${new Date().toISOString()}] Processing page ${pageNumber}/${this.extractionState.totalPages}`,
      );

      // Extract text from PDF page
      let pageText: string;
      try {
        pageText = await this.pdfService.extractTextFromPage(pageNumber);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.extractionState.logs.push(
          `[${new Date().toISOString()}] Page ${pageNumber}: Failed to extract text - ${errorMessage}`,
        );
        this.updateProgress(pageNumber);
        return;
      }

      if (!pageText || pageText.trim().length === 0) {
        this.extractionState.logs.push(
          `[${new Date().toISOString()}] Page ${pageNumber}: No text found, skipping`,
        );
        this.updateProgress(pageNumber);
        return;
      }

      // Extract questions using Ollama
      const extractedQuestions =
        await this.ollamaService.extractQuestionsFromText(
          pageText,
          pageNumber,
          pdf,
        );

      // Process and store questions
      const processedQuestions = await this.processExtractedQuestions(
        extractedQuestions,
        pageNumber,
      );

      // Log extraction results
      if (processedQuestions.length > 0) {
        this.extractionState.extractedQuestions += processedQuestions.length;
        this.extractionState.questionsPerPage[pageNumber] =
          processedQuestions.length;

        this.extractionState.logs.push(
          `[${new Date().toISOString()}] Page ${pageNumber}: Processed ${processedQuestions.length} questions`,
        );

        // Log details for each question
        processedQuestions.forEach((question, index) => {
          this.extractionState.logs.push(
            `[${new Date().toISOString()}] Page ${pageNumber}, Q${index + 1}: "${question.question.substring(0, 100)}..." (${question.categories.join(', ')})`,
          );
        });
      } else {
        this.extractionState.logs.push(
          `[${new Date().toISOString()}] Page ${pageNumber}: No valid questions found`,
        );
      }

      this.updateProgress(pageNumber);

      // Emit progress event
      this.eventEmitter.emit('extraction.progress', {
        page: pageNumber,
        total: this.extractionState.totalPages,
        progress: this.extractionState.progress,
        questionsExtracted: processedQuestions.length,
        timestamp: new Date(),
      });
    } catch (error) {
      this.extractionState.failedPages.push(pageNumber);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.extractionState.logs.push(
        `[${new Date().toISOString()}] Page ${pageNumber}: Error - ${errorMessage}`,
      );
      this.logger.error(`Failed to process page ${pageNumber}:`, error);
    }
  }

  // Process extracted questions with verification logic
  private async processExtractedQuestions(
    extractedQuestions: ExtractedQuestion[],
    pageNumber: number,
  ): Promise<ExtractedQuestion[]> {
    const processedQuestions: ExtractedQuestion[] = [];

    for (const extractedQuestion of extractedQuestions) {
      try {
        // Validate question quality
        if (!this.isQuestionValid(extractedQuestion)) {
          this.extractionState.logs.push(
            `[${new Date().toISOString()}] Page ${pageNumber}: Skipping invalid question - incomplete or meaningless`,
          );
          this.extractionState.skippedQuestions++;
          continue;
        }

        // Check if question already exists and is verified
        const existingQuestion =
          await this.findExistingQuestion(extractedQuestion);

        if (existingQuestion) {
          if (existingQuestion.status === QuestionStatus.APPROVED) {
            // Skip verified questions
            this.extractionState.logs.push(
              `[${new Date().toISOString()}] Page ${pageNumber}: Skipping verified question`,
            );
            this.extractionState.verifiedQuestions++;
            continue;
          } else {
            // Update existing unverified question if new one is better
            const shouldUpdate = this.shouldUpdateQuestion(
              existingQuestion,
              extractedQuestion,
            );

            if (shouldUpdate) {
              await this.updateExistingQuestion(
                existingQuestion.id,
                extractedQuestion,
              );
              this.extractionState.updatedQuestions++;
              this.extractionState.logs.push(
                `[${new Date().toISOString()}] Page ${pageNumber}: Updated existing question`,
              );
            } else {
              this.extractionState.skippedQuestions++;
              this.extractionState.logs.push(
                `[${new Date().toISOString()}] Page ${pageNumber}: Skipping - existing question is better`,
              );
            }
            continue;
          }
        }

        // Create new question
        await this.createNewQuestion(extractedQuestion);
        processedQuestions.push(extractedQuestion);
        this.extractionState.logs.push(
          `[${new Date().toISOString()}] Page ${pageNumber}: Created new question`,
        );
      } catch (error) {
        this.extractionState.logs.push(
          `[${new Date().toISOString()}] Page ${pageNumber}: Error processing question - ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        this.extractionState.skippedQuestions++;
      }
    }

    return processedQuestions;
  }

  // Validate question quality
  private isQuestionValid(question: ExtractedQuestion): boolean {
    // Check if question text is meaningful
    if (
      !question.question ||
      question.question.length < 20 ||
      question.question.length > 2000 ||
      question.question.includes('...') ||
      question.question.includes('???')
    ) {
      return false;
    }

    // Check if all options are meaningful
    const options = ['A', 'B', 'C', 'D', 'E'];
    for (const option of options) {
      const optionText = question.options[option];
      if (
        !optionText ||
        optionText.length < 3 ||
        optionText.length > 1000 ||
        optionText.includes('...') ||
        optionText.includes('???')
      ) {
        return false;
      }
    }

    // Check if correct answer is valid
    if (
      !question.correctAnswer ||
      !['A', 'B', 'C', 'D', 'E'].includes(question.correctAnswer)
    ) {
      return false;
    }

    // Check if categories are valid
    if (!question.categories || question.categories.length === 0) {
      return false;
    }

    // Check if year is reasonable
    if (
      !question.examYear ||
      question.examYear < 2000 ||
      question.examYear > 2030
    ) {
      return false;
    }

    // Check if intake is valid
    if (!question.intake) {
      return false;
    }

    return true;
  }

  // Find existing question by content similarity
  private async findExistingQuestion(
    extractedQuestion: ExtractedQuestion,
  ): Promise<Question | null> {
    try {
      // Simple similarity check - could be improved with more sophisticated matching
      const similarQuestions = await this.questionsService.findAll({
        search: extractedQuestion.question.substring(0, 100),
        limit: 10,
      });

      for (const question of similarQuestions.data) {
        if (
          this.calculateSimilarity(
            question.question,
            extractedQuestion.question,
          ) > 0.8
        ) {
          return question;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error finding existing question:', error);
      return null;
    }
  }

  // Calculate similarity between two strings (simple implementation)
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);

    const commonWords = words1.filter((word) => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;

    return commonWords.length / totalWords;
  }

  // Determine if new question should replace existing one
  private shouldUpdateQuestion(
    existingQuestion: any,
    newQuestion: ExtractedQuestion,
  ): boolean {
    // If existing question has higher confidence, don't update
    if (existingQuestion.aiMetadata?.confidence > newQuestion.confidence) {
      return false;
    }

    // If new question has significantly higher confidence, update
    if (
      newQuestion.confidence >
      (existingQuestion.aiMetadata?.confidence || 0) + 0.1
    ) {
      return true;
    }

    // If new question has better quality (longer, more complete), update
    if (newQuestion.question.length > existingQuestion.question.length * 1.2) {
      return true;
    }

    return false;
  }

  // Update existing question
  private async updateExistingQuestion(
    questionId: string,
    extractedQuestion: any,
  ): Promise<void> {
    try {
      await this.questionsService.update(questionId, {
        question: extractedQuestion.question,
        options: extractedQuestion.options,
        correctAnswer: extractedQuestion.correctAnswer,
        categories: extractedQuestion.categories,
        year: extractedQuestion.examYear,
        intake: extractedQuestion.intake,
        explanation: extractedQuestion.explanation,
        aiMetadata: {
          confidence: extractedQuestion.confidence,
          extractedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error updating existing question:', error);
      throw error;
    }
  }

  // Create new question
  private async createNewQuestion(extractedQuestion: any): Promise<void> {
    try {
      await this.questionsService.create({
        question: extractedQuestion.question,
        options: extractedQuestion.options,
        correctAnswer: extractedQuestion.correctAnswer,
        categories: extractedQuestion.categories,
        year: extractedQuestion.examYear,
        intake: extractedQuestion.intake,
        explanation: extractedQuestion.explanation,
        aiMetadata: {
          confidence: extractedQuestion.confidence,
          extractedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error creating new question:', error);
      throw error;
    }
  }

  // Update progress
  private updateProgress(pageNumber: number): void {
    this.extractionState.processedPages = pageNumber;
    this.extractionState.progress = Math.round(
      (pageNumber / this.extractionState.totalPages) * 100,
    );
  }

  // Handle extraction completion
  private handleExtractionComplete() {
    this.extractionState.status = 'completed';
    this.extractionState.endTime = new Date();
    this.extractionState.logs.push(
      `[${new Date().toISOString()}] Extraction completed successfully`,
    );
    this.extractionState.logs.push(
      `[${new Date().toISOString()}] Total questions extracted: ${this.extractionState.extractedQuestions}`,
    );
    this.extractionState.logs.push(
      `[${new Date().toISOString()}] Verified questions skipped: ${this.extractionState.verifiedQuestions}`,
    );
    this.extractionState.logs.push(
      `[${new Date().toISOString()}] Questions updated: ${this.extractionState.updatedQuestions}`,
    );
    this.extractionState.logs.push(
      `[${new Date().toISOString()}] Questions skipped: ${this.extractionState.skippedQuestions}`,
    );
    this.extractionState.logs.push(
      `[${new Date().toISOString()}] Failed pages: ${this.extractionState.failedPages.length}`,
    );

    this.logger.log(
      `Extraction completed for ${this.extractionState.selectedPdf}`,
    );

    // Emit completion event
    this.eventEmitter.emit('extraction.completed', {
      pdf: this.extractionState.selectedPdf,
      processedPages: this.extractionState.processedPages,
      failedPages: this.extractionState.failedPages,
      totalQuestions: this.extractionState.extractedQuestions,
      verifiedQuestions: this.extractionState.verifiedQuestions,
      updatedQuestions: this.extractionState.updatedQuestions,
      skippedQuestions: this.extractionState.skippedQuestions,
      timestamp: new Date(),
    });
  }

  // Handle extraction stop
  private handleExtractionStop() {
    this.extractionState.status = 'idle';
    this.extractionState.endTime = new Date();
    this.extractionState.logs.push(
      `[${new Date().toISOString()}] Extraction stopped by user`,
    );
    this.extractionState.logs.push(
      `[${new Date().toISOString()}] Questions extracted before stop: ${this.extractionState.extractedQuestions}`,
    );

    this.logger.log(
      `Extraction stopped for ${this.extractionState.selectedPdf}`,
    );

    // Emit stop event
    this.eventEmitter.emit('extraction.stopped', {
      pdf: this.extractionState.selectedPdf,
      processedPages: this.extractionState.processedPages,
      totalQuestions: this.extractionState.extractedQuestions,
      timestamp: new Date(),
    });
  }

  // Stop extraction
  stopExtraction(): { message: string } {
    if (this.extractionState.status !== 'processing') {
      return { message: 'No extraction in progress' };
    }

    this.isStopping = true;
    this.logger.log('Stopping extraction...');

    return { message: 'Extraction stop requested' };
  }

  // Get current extraction status
  getStatus(): ExtractionState {
    return { ...this.extractionState };
  }

  // Get current logs
  getLogs(): { logs: string[] } {
    return { logs: [...this.extractionState.logs] };
  }

  // Get extraction statistics
  getStatistics() {
    const duration =
      this.extractionState.startTime && this.extractionState.endTime
        ? this.extractionState.endTime.getTime() -
          this.extractionState.startTime.getTime()
        : 0;

    return {
      status: this.extractionState.status,
      selectedPdf: this.extractionState.selectedPdf,
      progress: this.extractionState.progress,
      processedPages: this.extractionState.processedPages,
      totalPages: this.extractionState.totalPages,
      failedPages: this.extractionState.failedPages,
      extractedQuestions: this.extractionState.extractedQuestions,
      verifiedQuestions: this.extractionState.verifiedQuestions,
      updatedQuestions: this.extractionState.updatedQuestions,
      skippedQuestions: this.extractionState.skippedQuestions,
      questionsPerPage: this.extractionState.questionsPerPage,
      duration: duration,
      startTime: this.extractionState.startTime,
      endTime: this.extractionState.endTime,
      error: this.extractionState.error,
    };
  }
}
