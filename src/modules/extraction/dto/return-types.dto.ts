export type ListPdfsResponse = string[];

export type StartExtractionResponse = {
  message: string;
  extractionId: string;
};

export type StopExtractionResponse = { message: string };

export type ExtractionStatusResponse = {
  status: 'idle' | 'processing' | 'completed' | 'failed' | 'stopped';
  selectedPdf: string;
  progress: number;
  totalPages: number;
  processedPages: number;
  failedPages: number[];
  logs: string[];
  startTime?: string;
  endTime?: string;
  error?: string;
  extractedQuestions: number;
  questionsPerPage: Record<number, number>;
  verifiedQuestions: number;
  updatedQuestions: number;
  skippedQuestions: number;
};

export type GetLogsResponse = { logs: string[] };

export type QueueStatusResponse = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
};

export type StatisticsResponse = {
  status: string;
  selectedPdf: string;
  progress: number;
  processedPages: number;
  totalPages: number;
  failedPages: number[];
  extractedQuestions: number;
  verifiedQuestions: number;
  updatedQuestions: number;
  skippedQuestions: number;
  questionsPerPage: Record<number, number>;
  duration: number;
  startTime: string | null;
  endTime: string | null;
  error: string | null;
};
