import { QuestionExplanationDto } from './question-explanation.dto';

export type StartAiExplanationResponse = {
  message: string;
  settingsId: string;
};

export type StopAiExplanationResponse = {
  message: string;
};

export type UpdateQuestionExplanationResponse = {
  message: string;
};

export type GetQuestionsForExplanationResponse = {
  questions: QuestionExplanationDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type GetLogsResponse = {
  logs: string[];
};

export type ResetSettingsResponse = {
  message: string;
};
