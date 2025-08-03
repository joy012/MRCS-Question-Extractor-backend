import { InjectQueue } from '@nestjs/bull';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bull';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { CategoriesService } from '../categories/categories.service';
import { QuestionsService } from '../questions/questions.service';
import { ExtractionStateDto, ExtractionStatus } from '../settings/dto';
import { SettingsService } from '../settings/settings.service';
import { StartExtractionDto } from './dto';
import { OllamaService } from './ollama.service';
import { PdfService } from './pdf.service';

export interface ExtractionEvent {
  type: 'start' | 'progress' | 'complete' | 'error' | 'stop';
  data: any;
  timestamp: Date;
}

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly ollamaService: OllamaService,
    private readonly pdfService: PdfService,
    private readonly questionsService: QuestionsService,
    private readonly categoriesService: CategoriesService,
    private readonly settingsService: SettingsService,
    @InjectQueue('extraction') private readonly extractionQueue: Queue,
  ) {}

  // List all PDFs in the data folder
  async listPdfs(): Promise<string[]> {
    const dataDir = join(process.cwd(), 'data');
    const files = await readdir(dataDir);
    return files.filter((f) => f.toLowerCase().endsWith('.pdf'));
  }

  // Start extraction for a selected PDF (non-blocking)
  async startExtraction(extractionDto: StartExtractionDto): Promise<{
    message: string;
    extractionId: string;
  }> {
    // Check if there's already an active extraction
    const currentState = await this.settingsService.getExtractionState();
    if (currentState && currentState.status === ExtractionStatus.PROCESSING) {
      throw new BadRequestException('Extraction already in progress');
    }

    // Generate unique extraction ID
    const extractionId = `extraction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize extraction state
    const initialState: ExtractionStateDto = {
      status: ExtractionStatus.PROCESSING,
      selectedPdf: extractionDto.filename,
      progress: 0,
      totalPages: 0,
      processedPages: 0,
      failedPages: [],
      logs: [
        `[${new Date().toISOString()}] Starting extraction for ${extractionDto.filename}`,
      ],
      startTime: new Date().toISOString(),
      extractedQuestions: 0,
      questionsPerPage: {},
      verifiedQuestions: 0,
      updatedQuestions: 0,
      skippedQuestions: 0,
      extractionId,
      model: extractionDto.model,
      startPage: extractionDto.startPage,
      maxPages: extractionDto.maxPages,
      overwrite: extractionDto.overwrite,
    };

    // Save initial state to database
    await this.settingsService.saveExtractionState(initialState);

    // Add job to Bull queue
    await this.extractionQueue.add('extract', {
      extractionId,
      filename: extractionDto.filename,
      model: extractionDto.model,
      startPage: extractionDto.startPage,
      maxPages: extractionDto.maxPages,
      overwrite: extractionDto.overwrite,
    });

    this.logger.log(
      `Started extraction job ${extractionId} for ${extractionDto.filename}`,
    );

    // Emit start event
    this.eventEmitter.emit('extraction.started', {
      pdf: extractionDto.filename,
      extractionId,
      timestamp: new Date(),
    });

    return {
      message: `Extraction started for ${extractionDto.filename}`,
      extractionId,
    };
  }

  // Stop extraction
  async stopExtraction(): Promise<{ message: string }> {
    const currentState = await this.settingsService.getExtractionState();

    if (!currentState || currentState.status !== ExtractionStatus.PROCESSING) {
      return { message: 'No extraction in progress' };
    }

    // Remove all jobs from the queue
    await this.extractionQueue.empty();

    // Update state to stopped
    const updatedState: ExtractionStateDto = {
      ...currentState,
      status: ExtractionStatus.STOPPED,
      endTime: new Date().toISOString(),
    };
    updatedState.logs.push(
      `[${new Date().toISOString()}] Extraction stopped by user`,
    );

    await this.settingsService.saveExtractionState(updatedState);

    this.logger.log('Extraction stopped');

    // Emit stop event
    this.eventEmitter.emit('extraction.stopped', {
      pdf: currentState.selectedPdf,
      processedPages: currentState.processedPages,
      totalQuestions: currentState.extractedQuestions,
      timestamp: new Date(),
    });

    return { message: 'Extraction stopped successfully' };
  }

  // Continue extraction from last processed page
  async continueExtraction(): Promise<{
    message: string;
    extractionId: string;
  }> {
    const currentState = await this.settingsService.getExtractionState();

    if (!currentState || currentState.status !== ExtractionStatus.STOPPED) {
      throw new BadRequestException('No stopped extraction to continue');
    }

    // Generate new extraction ID for the continuation
    const extractionId = `extraction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate the next page to start from
    const nextStartPage = currentState.processedPages + 1;

    // Check if there are more pages to process
    if (nextStartPage > currentState.totalPages) {
      throw new BadRequestException('All pages have been processed');
    }

    // Calculate remaining pages to process
    const originalMaxPages = currentState.maxPages || currentState.totalPages;
    const originalStartPage = currentState.startPage || 1;
    const remainingPagesToProcess =
      originalMaxPages -
      (currentState.processedPages - (originalStartPage - 1));

    // Update state to processing for continuation
    const updatedState: ExtractionStateDto = {
      ...currentState,
      status: ExtractionStatus.PROCESSING,
      extractionId,
      endTime: undefined, // Clear endTime since we're resuming
    };
    updatedState.logs.push(
      `[${new Date().toISOString()}] Continuing extraction from page ${nextStartPage}`,
    );

    await this.settingsService.saveExtractionState(updatedState);

    // Add job to Bull queue with updated parameters
    await this.extractionQueue.add('extract', {
      extractionId,
      filename: currentState.selectedPdf,
      model: currentState.model,
      startPage: nextStartPage,
      maxPages: remainingPagesToProcess,
      overwrite: currentState.overwrite,
      isContinuation: true, // Flag to indicate this is a continuation
    });

    this.logger.log(
      `Continued extraction job ${extractionId} for ${currentState.selectedPdf} from page ${nextStartPage}`,
    );

    // Emit continuation event
    this.eventEmitter.emit('extraction.continued', {
      pdf: currentState.selectedPdf,
      extractionId,
      fromPage: nextStartPage,
      timestamp: new Date(),
    });

    return {
      message: `Extraction continued for ${currentState.selectedPdf} from page ${nextStartPage}`,
      extractionId,
    };
  }

  // Get current extraction status
  async getStatus(): Promise<ExtractionStateDto> {
    const state = await this.settingsService.getExtractionState();

    if (!state) {
      // Return default idle state
      return {
        status: ExtractionStatus.IDLE,
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
    }

    return state;
  }

  // Get current logs
  async getLogs(): Promise<{ logs: string[] }> {
    const state = await this.settingsService.getExtractionState();
    return { logs: state?.logs || [] };
  }

  // Get extraction statistics
  async getStatistics() {
    const state = await this.settingsService.getExtractionState();

    if (!state) {
      return {
        status: 'idle',
        selectedPdf: '',
        progress: 0,
        processedPages: 0,
        totalPages: 0,
        failedPages: [],
        extractedQuestions: 0,
        verifiedQuestions: 0,
        updatedQuestions: 0,
        skippedQuestions: 0,
        questionsPerPage: {},
        duration: 0,
        startTime: null,
        endTime: null,
        error: null,
      };
    }

    const duration =
      state.startTime && state.endTime
        ? new Date(state.endTime).getTime() -
          new Date(state.startTime).getTime()
        : 0;

    return {
      status: state.status,
      selectedPdf: state.selectedPdf,
      progress: state.progress,
      processedPages: state.processedPages,
      totalPages: state.totalPages,
      failedPages: state.failedPages,
      extractedQuestions: state.extractedQuestions,
      verifiedQuestions: state.verifiedQuestions,
      updatedQuestions: state.updatedQuestions,
      skippedQuestions: state.skippedQuestions,
      questionsPerPage: state.questionsPerPage,
      duration: duration,
      startTime: state.startTime || null,
      endTime: state.endTime || null,
      error: state.error || null,
    };
  }

  // Clear extraction state (for cleanup)
  async clearExtractionState(): Promise<void> {
    await this.settingsService.clearExtractionState();
  }

  // Get queue status
  async getQueueStatus() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.extractionQueue.getWaiting(),
      this.extractionQueue.getActive(),
      this.extractionQueue.getCompleted(),
      this.extractionQueue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }
}
