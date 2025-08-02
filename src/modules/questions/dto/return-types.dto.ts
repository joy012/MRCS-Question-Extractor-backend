import { Question, QuestionStatus } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto';

export type CategoryStats = Array<{ category: string; count: number }>;
export type YearStats = Array<{ year: number; count: number }>;
export type IntakeStats = Array<{ intake: string; count: number }>;

export type QuestionStats = {
  total: number;
  byCategory: Record<string, number>;
  byYear: Record<number, number>;
  byIntake: Record<string, number>;
  byStatus: Record<QuestionStatus, number>;
  averageConfidence: number;
};

export type BulkCreateResponse = {
  created: number;
  skipped: number;
  errors: string[];
};

export type BulkUpdateStatusResponse = {
  updated: number;
  errors: string[];
};

export type CreateQuestionResponse = Question;
export type FindAllQuestionsResponse = PaginatedResponseDto<Question>;
export type FindOneQuestionResponse = Question | null;
export type UpdateQuestionResponse = Question | null;
export type RemoveQuestionResponse = boolean;
export type UpdateStatusResponse = Question | null;
