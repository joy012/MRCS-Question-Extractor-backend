import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export enum ExtractionStatus {
  IDLE = 'idle',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  STOPPED = 'stopped',
}

export class ExtractionStateDto {
  @ApiProperty({
    description: 'Current extraction status',
    enum: ExtractionStatus,
  })
  @IsEnum(ExtractionStatus)
  status: ExtractionStatus;

  @ApiProperty({
    description: 'Selected PDF filename',
  })
  @IsString()
  selectedPdf: string;

  @ApiProperty({
    description: 'Extraction progress percentage',
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  progress: number;

  @ApiProperty({
    description: 'Total pages in PDF',
    minimum: 0,
  })
  @IsNumber()
  totalPages: number;

  @ApiProperty({
    description: 'Number of processed pages',
    minimum: 0,
  })
  @IsNumber()
  processedPages: number;

  @ApiProperty({
    description: 'Array of failed page numbers',
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  failedPages: number[];

  @ApiProperty({
    description: 'Extraction logs',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  logs: string[];

  @ApiPropertyOptional({
    description: 'Extraction start time',
  })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({
    description: 'Extraction end time',
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Error message if extraction failed',
  })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiProperty({
    description: 'Number of extracted questions',
    minimum: 0,
  })
  @IsNumber()
  extractedQuestions: number;

  @ApiProperty({
    description: 'Questions per page mapping',
    additionalProperties: { type: 'number' },
  })
  questionsPerPage: Record<number, number>;

  @ApiProperty({
    description: 'Number of verified questions',
    minimum: 0,
  })
  @IsNumber()
  verifiedQuestions: number;

  @ApiProperty({
    description: 'Number of updated questions',
    minimum: 0,
  })
  @IsNumber()
  updatedQuestions: number;

  @ApiProperty({
    description: 'Number of skipped questions',
    minimum: 0,
  })
  @IsNumber()
  skippedQuestions: number;

  @ApiPropertyOptional({
    description: 'Extraction job ID',
  })
  @IsOptional()
  @IsString()
  extractionId?: string;

  @ApiPropertyOptional({
    description: 'AI model used for extraction',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Starting page number',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  startPage?: number;

  @ApiPropertyOptional({
    description: 'Maximum pages to process',
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  maxPages?: number;

  @ApiPropertyOptional({
    description: 'Whether to overwrite existing questions',
  })
  @IsOptional()
  overwrite?: boolean;
}
