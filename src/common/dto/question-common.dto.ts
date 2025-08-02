import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { QUESTION_VALIDATION } from '../CONSTANTS';

export class QuestionOptionsDto {
  @ApiProperty({
    description: 'Option A text',
    maxLength: QUESTION_VALIDATION.MAX_OPTION_LENGTH,
  })
  @IsString()
  @Length(1, QUESTION_VALIDATION.MAX_OPTION_LENGTH)
  A: string;

  @ApiProperty({
    description: 'Option B text',
    maxLength: QUESTION_VALIDATION.MAX_OPTION_LENGTH,
  })
  @IsString()
  @Length(1, QUESTION_VALIDATION.MAX_OPTION_LENGTH)
  B: string;

  @ApiProperty({
    description: 'Option C text',
    maxLength: QUESTION_VALIDATION.MAX_OPTION_LENGTH,
  })
  @IsString()
  @Length(1, QUESTION_VALIDATION.MAX_OPTION_LENGTH)
  C: string;

  @ApiProperty({
    description: 'Option D text',
    maxLength: QUESTION_VALIDATION.MAX_OPTION_LENGTH,
  })
  @IsString()
  @Length(1, QUESTION_VALIDATION.MAX_OPTION_LENGTH)
  D: string;

  @ApiProperty({
    description: 'Option E text',
    maxLength: QUESTION_VALIDATION.MAX_OPTION_LENGTH,
  })
  @IsString()
  @Length(1, QUESTION_VALIDATION.MAX_OPTION_LENGTH)
  E: string;
}

export class AiMetadataDto {
  @ApiPropertyOptional({
    description: 'AI confidence score (0-100)',
    minimum: QUESTION_VALIDATION.MIN_CONFIDENCE,
    maximum: QUESTION_VALIDATION.MAX_CONFIDENCE,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(QUESTION_VALIDATION.MIN_CONFIDENCE)
  @Max(QUESTION_VALIDATION.MAX_CONFIDENCE)
  confidence?: number;

  @ApiPropertyOptional({
    description: 'Extracted by identifier',
    default: 'AI',
  })
  @IsOptional()
  @IsString()
  extractedBy?: string;

  @ApiPropertyOptional({ description: 'Source file path' })
  @IsOptional()
  @IsString()
  sourceFile?: string;

  @ApiPropertyOptional({ description: 'Extraction timestamp' })
  @IsOptional()
  extractedAt?: Date;

  @ApiPropertyOptional({ description: 'AI model used' })
  @IsOptional()
  @IsString()
  aiModel?: string;

  @ApiPropertyOptional({ description: 'Processing time in milliseconds' })
  @IsOptional()
  @IsNumber()
  processingTime?: number;

  @ApiPropertyOptional({ description: 'Raw AI extraction data' })
  @IsOptional()
  @IsObject()
  rawExtraction?: any;
}
