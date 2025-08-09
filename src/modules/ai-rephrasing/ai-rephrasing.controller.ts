import { TypedBody, TypedParam, TypedQuery, TypedRoute } from '@nestia/core';
import { Controller } from '@nestjs/common';
import { AiRephrasingService } from './ai-rephrasing.service';
import {
  AiRephrasingSettingsDto,
  AiRephrasingStatisticsDto,
  AiRephrasingStatusDto,
  GetLogsResponse,
  GetQuestionsForRephrasingQueryDto,
  GetQuestionsForRephrasingResponse,
  ResetSettingsResponse,
  StartAiRephrasingDto,
  StartAiRephrasingResponse,
  StopAiRephrasingResponse,
  UpdateQuestionRephrasingDto,
  UpdateQuestionRephrasingResponse,
} from './dto';

@Controller('ai-rephrasing')
export class AiRephrasingController {
  constructor(private readonly aiRephrasingService: AiRephrasingService) {}

  /**
   * Get AI rephrasing settings
   * @summary Get AI rephrasing settings
   * @tag ai-rephrasing
   */
  @TypedRoute.Get('settings')
  getSettings(): Promise<AiRephrasingSettingsDto> {
    return this.aiRephrasingService.getSettings();
  }

  /**
   * Get AI rephrasing status
   * @summary Get AI rephrasing status
   * @tag ai-rephrasing
   */
  @TypedRoute.Get('status')
  getStatus(): Promise<AiRephrasingStatusDto> {
    return this.aiRephrasingService.getStatus();
  }

  /**
   * Get AI rephrasing statistics
   * @summary Get AI rephrasing statistics
   * @tag ai-rephrasing
   */
  @TypedRoute.Get('statistics')
  getStatistics(): Promise<AiRephrasingStatisticsDto> {
    return this.aiRephrasingService.getStatistics();
  }

  /**
   * Get AI rephrasing logs
   * @summary Get AI rephrasing logs
   * @tag ai-rephrasing
   */
  @TypedRoute.Get('logs')
  getLogs(): Promise<GetLogsResponse> {
    return this.aiRephrasingService.getLogs();
  }

  /**
   * Clear AI rephrasing logs
   * @summary Clear AI rephrasing logs
   * @tag ai-rephrasing
   */
  @TypedRoute.Delete('logs')
  clearLogs(): Promise<{ message: string }> {
    return Promise.resolve(this.aiRephrasingService.clearLogs());
  }

  /**
   * Start AI rephrasing processing
   * @summary Start AI rephrasing processing
   * @tag ai-rephrasing
   */
  @TypedRoute.Post('start')
  startRephrasing(
    @TypedBody() dto: StartAiRephrasingDto,
  ): Promise<StartAiRephrasingResponse> {
    return this.aiRephrasingService.startRephrasing(dto.model);
  }

  /**
   * Stop AI rephrasing processing
   * @summary Stop AI rephrasing processing
   * @tag ai-rephrasing
   */
  @TypedRoute.Post('stop')
  stopRephrasing(): Promise<StopAiRephrasingResponse> {
    return this.aiRephrasingService.stopRephrasing();
  }

  /**
   * Reset AI rephrasing settings
   * @summary Reset AI rephrasing settings
   * @tag ai-rephrasing
   */
  @TypedRoute.Post('reset')
  resetSettings(): Promise<ResetSettingsResponse> {
    return this.aiRephrasingService.resetSettings();
  }

  /**
   * Get questions for rephrasing
   * @summary Get questions for rephrasing
   * @tag ai-rephrasing
   */
  @TypedRoute.Get('questions')
  getQuestionsForRephrasing(
    @TypedQuery() query: GetQuestionsForRephrasingQueryDto,
  ): Promise<GetQuestionsForRephrasingResponse> {
    return this.aiRephrasingService.getQuestionsForRephrasing(query);
  }

  /**
   * Update question rephrasing
   * @summary Update question rephrasing
   * @tag ai-rephrasing
   */
  @TypedRoute.Put('questions/:id/rephrasing')
  updateQuestionRephrasing(
    @TypedParam('id') questionId: string,
    @TypedBody() dto: UpdateQuestionRephrasingDto,
  ): Promise<UpdateQuestionRephrasingResponse> {
    return this.aiRephrasingService.updateQuestionRephrasing(
      questionId,
      dto.aiRephrasedTitle,
    );
  }

  /**
   * Reset question processing
   * @summary Reset question processing
   * @tag ai-rephrasing
   */
  @TypedRoute.Post('questions/:id/reset')
  resetQuestionProcessing(@TypedParam('id') questionId: string): Promise<{
    message: string;
  }> {
    return this.aiRephrasingService.resetQuestionProcessing(questionId);
  }

  /**
   * Test rephrasing generation for a specific question
   * @summary Test rephrasing generation for a specific question
   * @tag ai-rephrasing
   */
  @TypedRoute.Post('questions/:id/test')
  testRephrasingGeneration(@TypedParam('id') questionId: string): Promise<{
    message: string;
    rephrasedTitle?: string;
    prompt?: string;
  }> {
    return this.aiRephrasingService.testRephrasingGeneration(questionId);
  }
}
