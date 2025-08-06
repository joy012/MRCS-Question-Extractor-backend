import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateQuestionExplanationDto {
  @ApiProperty({ description: 'AI explanation text' })
  @IsString()
  explanation: string;
}
