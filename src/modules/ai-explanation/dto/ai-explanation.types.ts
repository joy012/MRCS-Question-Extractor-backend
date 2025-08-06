export interface AiExplanationStatusDto {
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

export interface AiExplanationStatisticsDto {
  totalQuestions: number;
  questionsWithExplanation: number;
  questionsWithoutExplanation: number;
  explanationCoverage: number;
  questionsProcessedToday: number;
  questionsProcessedThisWeek: number;
  successRate: number;
  lastExplanationAdded?: string;
  modelUsage: Record<string, number>;
}

export interface AiExplanationSettingsDto {
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

export interface QuestionExplanationDto {
  id: string;
  question: string;
  explanation?: string;
  hasAiExplanation: boolean;
  explanationAddedAt?: string;
  explanationModel?: string;
  status: string;
}
