import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateQuestionRephrasingDto {
  @ApiProperty({
    description: 'AI rephrased question title',
    example: 'What is the most common cause of acute appendicitis in adults?',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  aiRephrasedTitle: string;
}
