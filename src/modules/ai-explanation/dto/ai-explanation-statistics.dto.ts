import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class AiExplanationStatisticsDto {
  @ApiProperty({ description: 'Total number of questions' })
  @IsNumber()
  totalQuestions: number;

  @ApiProperty({ description: 'Number of questions with explanations' })
  @IsNumber()
  questionsWithExplanation: number;

  @ApiProperty({ description: 'Number of questions without explanations' })
  @IsNumber()
  questionsWithoutExplanation: number;

  @ApiProperty({ description: 'Explanation coverage percentage' })
  @IsNumber()
  explanationCoverage: number;

  @ApiProperty({ description: 'Number of questions processed today' })
  @IsNumber()
  questionsProcessedToday: number;

  @ApiProperty({ description: 'Number of questions processed this week' })
  @IsNumber()
  questionsProcessedThisWeek: number;

  @ApiProperty({ description: 'Success rate percentage' })
  @IsNumber()
  successRate: number;

  @ApiProperty({
    description: 'Last explanation added timestamp',
    required: false,
  })
  @IsOptional()
  lastExplanationAdded?: string;

  @ApiProperty({ description: 'Model usage statistics' })
  modelUsage: Record<string, number>;
}
