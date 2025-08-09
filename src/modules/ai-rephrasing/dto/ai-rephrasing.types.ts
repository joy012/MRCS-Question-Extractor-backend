export interface AiRephrasingStatusDto {
  isActive: boolean;
  status: 'idle' | 'processing' | 'completed' | 'stopped' | 'failed';
  model: string;
  totalQuestions: number;
  processedQuestions: number;
  skippedQuestions: number;
  failedQuestions: number;
  progress: number;
  lastProcessedQuestion?: string;
  lastProcessedAt?: string;
  startedAt?: string;
  stoppedAt?: string;
  error?: string;
  estimatedTimeRemaining?: number;
}

export interface AiRephrasingStatisticsDto {
  totalQuestions: number;
  questionsWithRephrasedTitle: number;
  questionsWithoutRephrasedTitle: number;
  rephrasingCoverage: number;
  questionsProcessedToday: number;
  questionsProcessedThisWeek: number;
  successRate: number;
  lastRephrasingAdded?: string;
  modelUsage: Record<string, number>;
}

export interface AiRephrasingSettingsDto {
  id: string;
  isActive: boolean;
  model: string;
  totalQuestions: number;
  processedQuestions: number;
  skippedQuestions: number;
  failedQuestions: number;
  processedQuestionIds: string[];
  lastProcessedQuestion?: string;
  lastProcessedAt?: string;
  startedAt?: string;
  stoppedAt?: string;
  status: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionRephrasingDto {
  id: string;
  question: string;
  aiRephrasedTitle?: string;
  hasAiRephrasedTitle: boolean;
  rephrasingAddedAt?: string;
  rephrasingModel?: string;
  status: string;
}
