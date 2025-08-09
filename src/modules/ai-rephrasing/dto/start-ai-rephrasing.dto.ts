import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class StartAiRephrasingDto {
  @ApiProperty({
    description: 'AI model to use for rephrasing',
    example: 'llama3.1',
    default: 'llama3.1',
  })
  @IsString()
  @IsOptional()
  model?: string = 'llama3.1';
}
