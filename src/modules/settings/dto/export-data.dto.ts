import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export enum ExportFormat {
  JSON = 'json',
  CSV = 'csv',
  PDF = 'pdf',
  EXCEL = 'excel',
}

export class ExportDataDto {
  @ApiProperty({
    description: 'Export format',
    enum: ExportFormat,
    default: ExportFormat.JSON,
  })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiPropertyOptional({
    description: 'Include questions data',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeQuestions?: boolean;

  @ApiPropertyOptional({
    description: 'Include extraction data',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeExtraction?: boolean;

  @ApiPropertyOptional({
    description: 'Include system statistics',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeStatistics?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by categories',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Filter by exam year',
  })
  @IsOptional()
  @IsString()
  examYear?: string;

  @ApiPropertyOptional({
    description: 'Filter by verification status',
  })
  @IsOptional()
  @IsString()
  verified?: string;

  @ApiPropertyOptional({
    description: 'Search term for questions',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Include metadata',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeMetadata?: boolean;

  @ApiPropertyOptional({
    description: 'Compress the export file',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  compress?: boolean;
}
