import { TypedBody, TypedParam, TypedQuery, TypedRoute } from '@nestia/core';
import { Controller } from '@nestjs/common';
import { AiExplanationService } from './ai-explanation.service';
import {
  AiExplanationSettingsDto,
  AiExplanationStatisticsDto,
  AiExplanationStatusDto,
  GetLogsResponse,
  GetQuestionsForExplanationResponse,
  GetQuestionsQueryDto,
  ResetSettingsResponse,
  StartAiExplanationDto,
  StartAiExplanationResponse,
  StopAiExplanationResponse,
  UpdateQuestionExplanationDto,
  UpdateQuestionExplanationResponse,
} from './dto';

@Controller('ai-explanation')
export class AiExplanationController {
  constructor(private readonly aiExplanationService: AiExplanationService) {}

  /**
   * Get AI explanation settings
   * @summary Get AI explanation settings
   * @tag ai-explanation
   */
  @TypedRoute.Get('settings')
  getSettings(): Promise<AiExplanationSettingsDto> {
    return this.aiExplanationService.getSettings();
  }

  /**
   * Get AI explanation status
   * @summary Get AI explanation status
   * @tag ai-explanation
   */
  @TypedRoute.Get('status')
  getStatus(): Promise<AiExplanationStatusDto> {
    return this.aiExplanationService.getStatus();
  }

  /**
   * Get AI explanation statistics
   * @summary Get AI explanation statistics
   * @tag ai-explanation
   */
  @TypedRoute.Get('statistics')
  getStatistics(): Promise<AiExplanationStatisticsDto> {
    return this.aiExplanationService.getStatistics();
  }

  /**
   * Start AI explanation processing
   * @summary Start AI explanation processing
   * @tag ai-explanation
   */
  @TypedRoute.Post('start')
  startExplanation(
    @TypedBody() dto: StartAiExplanationDto,
  ): Promise<StartAiExplanationResponse> {
    return this.aiExplanationService.startExplanation(dto.model);
  }

  /**
   * Stop AI explanation processing
   * @summary Stop AI explanation processing
   * @tag ai-explanation
   */
  @TypedRoute.Post('stop')
  stopExplanation(): Promise<StopAiExplanationResponse> {
    return this.aiExplanationService.stopExplanation();
  }

  /**
   * Get questions for AI explanation
   * @summary Get questions for AI explanation
   * @tag ai-explanation
   */
  @TypedRoute.Get('questions')
  getQuestionsForExplanation(
    @TypedQuery() query: GetQuestionsQueryDto,
  ): Promise<GetQuestionsForExplanationResponse> {
    return this.aiExplanationService.getQuestionsForExplanation(query);
  }

  /**
   * Update question explanation
   * @summary Update question explanation
   * @tag ai-explanation
   */
  @TypedRoute.Put('questions/:id/explanation')
  updateQuestionExplanation(
    @TypedParam('id') questionId: string,
    @TypedBody() body: UpdateQuestionExplanationDto,
  ): Promise<UpdateQuestionExplanationResponse> {
    return this.aiExplanationService.updateQuestionExplanation(
      questionId,
      body.explanation,
    );
  }

  /**
   * Get AI explanation logs
   * @summary Get AI explanation logs
   * @tag ai-explanation
   */
  @TypedRoute.Get('logs')
  getLogs(): Promise<GetLogsResponse> {
    return this.aiExplanationService.getLogs();
  }

  /**
   * Clear AI explanation logs
   * @summary Clear AI explanation logs
   * @tag ai-explanation
   */
  @TypedRoute.Delete('logs')
  clearLogs(): Promise<{ message: string }> {
    return this.aiExplanationService.clearLogs();
  }

  /**
   * Reset AI explanation settings
   * @summary Reset AI explanation settings
   * @tag ai-explanation
   */
  @TypedRoute.Delete('reset')
  resetSettings(): Promise<ResetSettingsResponse> {
    return this.aiExplanationService.resetSettings();
  }

  /**
   * Reset AI processing state for a specific question
   * @summary Reset AI processing state for a specific question
   * @tag ai-explanation
   */
  @TypedRoute.Delete('questions/:id/reset')
  resetQuestionProcessing(
    @TypedParam('id') questionId: string,
  ): Promise<{ message: string }> {
    return this.aiExplanationService.resetQuestionProcessing(questionId);
  }

  /**
   * Test explanation generation for a specific question
   * @summary Test explanation generation for a specific question
   * @tag ai-explanation
   */
  @TypedRoute.Post('questions/:id/test')
  testExplanationGeneration(@TypedParam('id') questionId: string): Promise<{
    message: string;
    explanation?: string;
    prompt?: string;
  }> {
    return this.aiExplanationService.testExplanationGeneration(questionId);
  }
}
