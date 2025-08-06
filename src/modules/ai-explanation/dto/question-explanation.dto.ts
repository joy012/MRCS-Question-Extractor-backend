import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QuestionExplanationDto {
  @ApiProperty({ description: 'Question ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Question text' })
  @IsString()
  question: string;

  @ApiProperty({ description: 'AI explanation', required: false })
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiProperty({ description: 'Whether question has AI explanation' })
  @IsBoolean()
  hasAiExplanation: boolean;

  @ApiProperty({ description: 'Explanation added timestamp', required: false })
  @IsOptional()
  explanationAddedAt?: string;

  @ApiProperty({
    description: 'AI model used for explanation',
    required: false,
  })
  @IsOptional()
  @IsString()
  explanationModel?: string;

  @ApiProperty({ description: 'Question status' })
  @IsString()
  status: string;
}
