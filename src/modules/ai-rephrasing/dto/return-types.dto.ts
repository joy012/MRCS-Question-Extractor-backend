export interface StartAiRephrasingResponse {
  message: string;
  settingsId: string;
}

export interface StopAiRephrasingResponse {
  message: string;
}

export interface GetQuestionsForRephrasingResponse {
  questions: Array<{
    id: string;
    question: string;
    aiRephrasedTitle?: string;
    hasAiRephrasedTitle: boolean;
    rephrasingAddedAt?: string;
    rephrasingModel?: string;
    status: string;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface UpdateQuestionRephrasingResponse {
  message: string;
}

export interface ResetSettingsResponse {
  message: string;
}

export interface GetLogsResponse {
  logs: string[];
}
