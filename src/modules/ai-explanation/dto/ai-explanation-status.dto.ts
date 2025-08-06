import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class AiExplanationStatusDto {
  @ApiProperty({ description: 'Whether AI explanation is active' })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ description: 'Current status of AI explanation process' })
  @IsString()
  status: 'idle' | 'processing' | 'completed' | 'stopped' | 'failed';

  @ApiProperty({ description: 'AI model being used' })
  @IsString()
  model: string;

  @ApiProperty({ description: 'Total number of questions' })
  @IsNumber()
  totalQuestions: number;

  @ApiProperty({ description: 'Number of processed questions' })
  @IsNumber()
  processedQuestions: number;

  @ApiProperty({ description: 'Number of skipped questions' })
  @IsNumber()
  skippedQuestions: number;

  @ApiProperty({ description: 'Number of failed questions' })
  @IsNumber()
  failedQuestions: number;

  @ApiProperty({ description: 'Progress percentage' })
  @IsNumber()
  progress: number;

  @ApiProperty({ description: 'Last processed question ID', required: false })
  @IsOptional()
  @IsString()
  lastProcessedQuestion?: string;

  @ApiProperty({ description: 'Last processed timestamp', required: false })
  @IsOptional()
  lastProcessedAt?: string;

  @ApiProperty({ description: 'Started timestamp', required: false })
  @IsOptional()
  startedAt?: string;

  @ApiProperty({ description: 'Stopped timestamp', required: false })
  @IsOptional()
  stoppedAt?: string;

  @ApiProperty({ description: 'Error message', required: false })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiProperty({
    description: 'Estimated time remaining in seconds',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  estimatedTimeRemaining?: number;
}
