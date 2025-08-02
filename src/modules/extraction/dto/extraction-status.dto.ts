import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDate,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class ExtractionStatusDto {
  @ApiProperty({
    description: 'Current page being processed',
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  currentPage: number;

  @ApiProperty({
    description: 'Total pages to process',
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  totalPages: number;

  @ApiProperty({
    description: 'Whether extraction is currently running',
  })
  @IsBoolean()
  isExtracting: boolean;

  @ApiPropertyOptional({
    description: 'Last extraction timestamp',
  })
  @IsOptional()
  @IsDate()
  lastExtractedAt?: Date;

  @ApiProperty({
    description: 'Number of questions extracted',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  extractedCount: number;

  @ApiProperty({
    description: 'Number of errors encountered',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  errorCount: number;

  @ApiProperty({
    description: 'Progress percentage',
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercentage: number;
}
