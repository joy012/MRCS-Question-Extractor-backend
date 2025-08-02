import { TypedBody, TypedRoute } from '@nestia/core';
import { Controller } from '@nestjs/common';
import {
  ExtractionStatusResponse,
  GetLogsResponse,
  ListPdfsResponse,
  StartExtractionResponse,
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
  startExtraction(@TypedBody() body: { pdf: string }): StartExtractionResponse {
    return this.extractionService.startExtraction(body.pdf);
  }

  /**
   * Stop extraction
   * @summary Stop extraction
   * @tag extraction
   */
  @TypedRoute.Delete('stop')
  stopExtraction(): StopExtractionResponse {
    return this.extractionService.stopExtraction();
  }

  /**
   * Get current extraction status
   * @summary Get current extraction status
   * @tag extraction
   */
  @TypedRoute.Get('status')
  getStatus(): ExtractionStatusResponse {
    return this.extractionService.getStatus();
  }

  /**
   * Get extraction logs
   * @summary Get extraction logs
   * @tag extraction
   */
  @TypedRoute.Get('logs')
  getLogs(): GetLogsResponse {
    return this.extractionService.getLogs();
  }
}
