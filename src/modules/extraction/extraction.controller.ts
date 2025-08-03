import { TypedBody, TypedRoute } from '@nestia/core';
import { Controller } from '@nestjs/common';
import {
  ExtractionStatusResponse,
  GetLogsResponse,
  ListPdfsResponse,
  QueueStatusResponse,
  StartExtractionDto,
  StartExtractionResponse,
  StatisticsResponse,
  StopExtractionResponse,
} from './dto';
import { ExtractionService } from './extraction.service';

@Controller('extraction')
export class ExtractionController {
  constructor(private readonly extractionService: ExtractionService) {}

  /**
   * List all available PDFs
   * @summary List all available PDFs
   * @tag extraction
   */
  @TypedRoute.Get('pdfs')
  async listPdfs(): Promise<ListPdfsResponse> {
    return await this.extractionService.listPdfs();
  }

  /**
   * Start extraction for a selected PDF
   * @summary Start extraction for a selected PDF
   * @tag extraction
   */
  @TypedRoute.Post('start')
  async startExtraction(
    @TypedBody() body: StartExtractionDto,
  ): Promise<StartExtractionResponse> {
    return await this.extractionService.startExtraction(body);
  }

  /**
   * Stop extraction
   * @summary Stop extraction
   * @tag extraction
   */
  @TypedRoute.Delete('stop')
  async stopExtraction(): Promise<StopExtractionResponse> {
    return await this.extractionService.stopExtraction();
  }

  /**
   * Continue extraction from last processed page
   * @summary Continue extraction from last processed page
   * @tag extraction
   */
  @TypedRoute.Post('continue')
  async continueExtraction(): Promise<StartExtractionResponse> {
    return await this.extractionService.continueExtraction();
  }

  /**
   * Get current extraction status
   * @summary Get current extraction status
   * @tag extraction
   */
  @TypedRoute.Get('status')
  async getStatus(): Promise<ExtractionStatusResponse> {
    return await this.extractionService.getStatus();
  }

  /**
   * Get extraction logs
   * @summary Get extraction logs
   * @tag extraction
   */
  @TypedRoute.Get('logs')
  async getLogs(): Promise<GetLogsResponse> {
    return await this.extractionService.getLogs();
  }

  /**
   * Get extraction statistics
   * @summary Get extraction statistics
   * @tag extraction
   */
  @TypedRoute.Get('statistics')
  async getStatistics(): Promise<StatisticsResponse> {
    return await this.extractionService.getStatistics();
  }

  /**
   * Get queue status
   * @summary Get queue status
   * @tag extraction
   */
  @TypedRoute.Get('queue-status')
  async getQueueStatus(): Promise<QueueStatusResponse> {
    return await this.extractionService.getQueueStatus();
  }

  /**
   * Clear extraction state
   * @summary Clear extraction state
   * @tag extraction
   */
  @TypedRoute.Delete('clear')
  async clearExtractionState(): Promise<{ message: string }> {
    await this.extractionService.clearExtractionState();
    return { message: 'Extraction state cleared successfully' };
  }
}
