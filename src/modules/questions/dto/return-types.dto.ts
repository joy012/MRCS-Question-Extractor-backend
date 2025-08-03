import { Category, Intake, Question, QuestionStatus } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto';

export type CategoryStats = Array<{
  category: string;
  count: number;
  id: string;
}>;
export type YearStats = Array<{ year: number; count: number }>;
export type IntakeStats = Array<{ intake: string; count: number; id: string }>;

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

export type QuestionWithRelations = Question & {
  categories: Category[];
  intake: Intake;
};

export type CreateQuestionResponse = Question;
export type FindAllQuestionsResponse =
  PaginatedResponseDto<QuestionWithRelations>;
export type FindOneQuestionResponse = QuestionWithRelations | null;
export type UpdateQuestionResponse = Question | null;
export type RemoveQuestionResponse = boolean;
export type UpdateStatusResponse = Question | null;
