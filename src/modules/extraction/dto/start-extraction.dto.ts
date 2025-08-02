import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class StartExtractionDto {
  @ApiProperty({
    description: 'PDF filename to extract from',
    example: 'mrcs-questions.pdf',
  })
  @IsString()
  filename: string;

  @ApiPropertyOptional({
    description: 'Maximum pages to extract (default: 1896)',
    minimum: 1,
    maximum: 1896,
    default: 1896,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1896)
  maxPages?: number;

  @ApiPropertyOptional({
    description: 'Batch size for processing pages',
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  batchSize?: number;

  @ApiPropertyOptional({
    description: 'Whether to overwrite existing questions',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;

  @ApiPropertyOptional({
    description: 'Ollama model to use for extraction',
    default: 'llama3.1',
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({
    description: 'Starting page number',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  startPage?: number;
}
