import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class StartAiExplanationDto {
  @ApiProperty({
    description: 'AI model to use',
    required: false,
    default: 'meditron',
  })
  @IsOptional()
  @IsString()
  model?: string;
}
