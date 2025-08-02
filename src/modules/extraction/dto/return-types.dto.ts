export type ListPdfsResponse = string[];

export type StartExtractionResponse = {
  message: string;
  extractionId: string;
};

export type StopExtractionResponse = { message: string };

export type ExtractionStatusResponse = {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  selectedPdf: string;
  progress: number;
  totalPages: number;
  processedPages: number;
  failedPages: number[];
  logs: string[];
  startTime?: Date;
  endTime?: Date;
  error?: string;
  extractedQuestions: number;
  questionsPerPage: Record<number, number>;
  verifiedQuestions: number;
  updatedQuestions: number;
  skippedQuestions: number;
};

export type GetLogsResponse = { logs: string[] };
