import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { QUESTION_VALIDATION, QuestionStatus } from '../../../common/CONSTANTS';
import { SearchDto } from '../../../common/dto';

export class QuestionFilterDto extends SearchDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: QuestionStatus,
  })
  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @ApiPropertyOptional({
    description: 'Filter by explanation status',
    enum: ['all', 'with_explanation', 'without_explanation'],
  })
  @IsOptional()
  @IsString()
  explanation?: 'all' | 'with_explanation' | 'without_explanation';

  @ApiPropertyOptional({
    description: 'Filter by rephrasing status',
    enum: ['all', 'with_rephrasing', 'without_rephrasing'],
  })
  @IsOptional()
  @IsString()
  rephrasing?: 'all' | 'with_rephrasing' | 'without_rephrasing';

  @ApiPropertyOptional({
    description: 'Filter by intake ID',
  })
  @IsOptional()
  intake?: string;

  @ApiPropertyOptional({
    description: 'Filter by category IDs',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Filter by year',
    minimum: QUESTION_VALIDATION.MIN_YEAR,
    maximum: QUESTION_VALIDATION.MAX_YEAR,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(QUESTION_VALIDATION.MIN_YEAR)
  @Max(QUESTION_VALIDATION.MAX_YEAR)
  year?: number;

  @ApiPropertyOptional({
    description: 'Minimum confidence score for AI extracted questions',
    minimum: QUESTION_VALIDATION.MIN_CONFIDENCE,
    maximum: QUESTION_VALIDATION.MAX_CONFIDENCE,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(QUESTION_VALIDATION.MIN_CONFIDENCE)
  @Max(QUESTION_VALIDATION.MAX_CONFIDENCE)
  minConfidence?: number;
}
