import { TypedBody, TypedParam, TypedQuery, TypedRoute } from '@nestia/core';
import { Controller } from '@nestjs/common';
import { QuestionStatus } from '../../common/CONSTANTS';
import {
  BulkCreateQuestionDto,
  BulkCreateResponse,
  BulkUpdateStatusDto,
  BulkUpdateStatusResponse,
  CategoryStats,
  CreateQuestionResponse,
  FindAllQuestionsResponse,
  FindOneQuestionResponse,
  IntakeStats,
  QuestionFilterDto,
  QuestionStats,
  RemoveQuestionResponse,
  UpdateQuestionDto,
  UpdateQuestionResponse,
  UpdateStatusResponse,
  YearStats,
} from './dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { QuestionsService } from './questions.service';

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  /**
   * Create a new question
   * @summary Create a new question
   * @tag questions
   */
  @TypedRoute.Post()
  create(
    @TypedBody() createQuestionDto: CreateQuestionDto,
  ): Promise<CreateQuestionResponse> {
    return this.questionsService.create(createQuestionDto);
  }

  /**
   * Create multiple questions
   * @summary Create multiple questions
   * @tag questions
   */
  @TypedRoute.Post('bulk')
  bulkCreate(
    @TypedBody() bulkCreateDto: BulkCreateQuestionDto,
  ): Promise<BulkCreateResponse> {
    return this.questionsService.bulkCreate(bulkCreateDto.questions);
  }

  /**
   * Get all questions with filtering and pagination
   * @summary Get all questions with filtering and pagination
   * @tag questions
   */
  @TypedRoute.Get()
  findAll(
    @TypedQuery() filters: QuestionFilterDto,
  ): Promise<FindAllQuestionsResponse> {
    return this.questionsService.findAll(filters);
  }

  /**
   * Get question statistics
   * @summary Get question statistics
   * @tag questions
   */
  @TypedRoute.Get('statistics')
  getStatistics(): Promise<QuestionStats> {
    return this.questionsService.getStatistics();
  }

  /**
   * Get all available categories
   * @summary Get all available categories
   * @tag questions
   */
  @TypedRoute.Get('categories')
  getCategories(): Promise<CategoryStats> {
    return this.questionsService.getCategories();
  }

  /**
   * Get all available years
   * @summary Get all available years
   * @tag questions
   */
  @TypedRoute.Get('years')
  getYears(): Promise<YearStats> {
    return this.questionsService.getYears();
  }

  /**
   * Get all available intakes
   * @summary Get all available intakes
   * @tag questions
   */
  @TypedRoute.Get('intakes')
  getIntakes(): Promise<IntakeStats> {
    return this.questionsService.getIntakes();
  }

  /**
   * Get a question by ID
   * @summary Get a question by ID
   * @tag questions
   */
  @TypedRoute.Get(':id')
  findOne(@TypedParam('id') id: string): Promise<FindOneQuestionResponse> {
    return this.questionsService.findOne(id);
  }

  /**
   * Update a question
   * @summary Update a question
   * @tag questions
   */
  @TypedRoute.Patch(':id')
  update(
    @TypedParam('id') id: string,
    @TypedBody() updateQuestionDto: UpdateQuestionDto,
  ): Promise<UpdateQuestionResponse> {
    return this.questionsService.update(id, updateQuestionDto);
  }

  /**
   * Delete a question
   * @summary Delete a question
   * @tag questions
   */
  @TypedRoute.Delete(':id')
  remove(@TypedParam('id') id: string): Promise<RemoveQuestionResponse> {
    return this.questionsService.remove(id);
  }

  /**
   * Update question status
   * @summary Update question status
   * @tag questions
   */
  @TypedRoute.Post(':id/status')
  updateStatus(
    @TypedParam('id') id: string,
    @TypedBody() body: { status: 'PENDING' | 'APPROVED' | 'REJECTED' },
  ): Promise<UpdateStatusResponse> {
    return this.questionsService.updateStatus(
      id,
      body.status as QuestionStatus,
    );
  }

  /**
   * Update status for multiple questions
   * @summary Update status for multiple questions
   * @tag questions
   */
  @TypedRoute.Post('bulk-status')
  bulkUpdateStatus(
    @TypedBody() bulkUpdateStatusDto: BulkUpdateStatusDto,
  ): Promise<BulkUpdateStatusResponse> {
    return this.questionsService.bulkUpdateStatus(
      bulkUpdateStatusDto.ids,
      bulkUpdateStatusDto.status,
    );
  }
}
