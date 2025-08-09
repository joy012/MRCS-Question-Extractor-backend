import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  QUESTION_ANSWER_OPTIONS,
  QUESTION_VALIDATION,
  QuestionStatus,
} from '../../../common/CONSTANTS';
import { AiMetadataDto, QuestionOptionsDto } from '../../../common/dto';

export class CreateQuestionDto {
  @ApiProperty({
    description: 'Question text',
    minLength: QUESTION_VALIDATION.MIN_QUESTION_LENGTH,
    maxLength: QUESTION_VALIDATION.MAX_QUESTION_LENGTH,
    example:
      'Which of the following is the most common cause of acute appendicitis?',
  })
  @IsString()
  @Length(
    QUESTION_VALIDATION.MIN_QUESTION_LENGTH,
    QUESTION_VALIDATION.MAX_QUESTION_LENGTH,
  )
  question: string;

  @ApiPropertyOptional({
    description: 'AI rephrased question title',
    maxLength: QUESTION_VALIDATION.MAX_QUESTION_LENGTH,
    example: 'What is the most common cause of acute appendicitis in adults?',
  })
  @IsOptional()
  @IsString()
  @Length(0, QUESTION_VALIDATION.MAX_QUESTION_LENGTH)
  aiRephrasedTitle?: string;

  @ApiProperty({
    description: 'Question options A, B, C, D, E',
    type: QuestionOptionsDto,
    example: {
      A: 'Bacterial infection',
      B: 'Viral infection',
      C: 'Obstruction of appendiceal lumen',
      D: 'Dietary factors',
      E: 'None of the above',
    },
  })
  @ValidateNested()
  @Type(() => QuestionOptionsDto)
  options: QuestionOptionsDto;

  @ApiProperty({
    description: 'Correct answer choice',
    enum: QUESTION_ANSWER_OPTIONS,
    example: 'C',
  })
  @IsEnum(QUESTION_ANSWER_OPTIONS)
  correctAnswer: string;

  @ApiPropertyOptional({
    description: 'Question description',
    maxLength: QUESTION_VALIDATION.MAX_DESCRIPTION_LENGTH,
    example: 'Additional context or description for the question',
  })
  @IsOptional()
  @IsString()
  @Length(0, QUESTION_VALIDATION.MAX_DESCRIPTION_LENGTH)
  description?: string;

  @ApiProperty({
    description: 'Exam year',
    minimum: QUESTION_VALIDATION.MIN_YEAR,
    maximum: QUESTION_VALIDATION.MAX_YEAR,
    example: 2023,
  })
  @IsNumber()
  @Min(QUESTION_VALIDATION.MIN_YEAR)
  @Max(QUESTION_VALIDATION.MAX_YEAR)
  year: number;

  @ApiProperty({
    description: 'Intake ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsString()
  intake: string;

  @ApiProperty({
    description: 'Category IDs',
    type: [String],
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  categories: string[];

  @ApiPropertyOptional({
    description: 'Explanation or solution description',
    maxLength: QUESTION_VALIDATION.MAX_EXPLANATION_LENGTH,
    example:
      'Acute appendicitis is most commonly caused by obstruction of the appendiceal lumen...',
  })
  @IsOptional()
  @IsString()
  @Length(0, QUESTION_VALIDATION.MAX_EXPLANATION_LENGTH)
  explanation?: string;

  @ApiPropertyOptional({
    description: 'Question status',
    enum: QuestionStatus,
    default: QuestionStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @ApiPropertyOptional({
    description: 'AI extraction metadata',
    type: AiMetadataDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AiMetadataDto)
  aiMetadata?: AiMetadataDto;
}
