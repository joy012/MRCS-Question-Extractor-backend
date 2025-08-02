import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: 'Application theme',
    enum: ['light', 'dark', 'system'],
    default: 'light',
  })
  @IsOptional()
  @IsString()
  theme?: 'light' | 'dark' | 'system';

  @ApiPropertyOptional({
    description: 'Enable notifications',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  notifications?: boolean;

  @ApiPropertyOptional({
    description: 'Enable auto refresh',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  autoRefresh?: boolean;

  @ApiPropertyOptional({
    description: 'Refresh interval in seconds',
    minimum: 5,
    maximum: 300,
    default: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(300)
  refreshInterval?: number;

  @ApiPropertyOptional({
    description: 'Default page size',
    minimum: 10,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({
    description: 'Enable sound notifications',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  enableSound?: boolean;

  @ApiPropertyOptional({
    description: 'Enable compact mode',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  compactMode?: boolean;

  @ApiPropertyOptional({
    description: 'Show confidence scores',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  showConfidence?: boolean;

  @ApiPropertyOptional({
    description: 'API timeout in seconds',
    minimum: 10,
    maximum: 300,
    default: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(300)
  apiTimeout?: number;

  @ApiPropertyOptional({
    description: 'Maximum retry attempts',
    minimum: 1,
    maximum: 10,
    default: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({
    description: 'Batch size for extraction',
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
    description: 'Ollama model to use',
    default: 'llama3.1',
  })
  @IsOptional()
  @IsString()
  ollamaModel?: string;

  @ApiPropertyOptional({
    description: 'Extraction quality setting',
    enum: ['fast', 'balanced', 'high'],
    default: 'balanced',
  })
  @IsOptional()
  @IsString()
  extractionQuality?: 'fast' | 'balanced' | 'high';

  @ApiPropertyOptional({
    description: 'Enable auto backup',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  autoBackup?: boolean;

  @ApiPropertyOptional({
    description: 'Backup interval in hours',
    minimum: 1,
    maximum: 168,
    default: 24,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168)
  backupInterval?: number;
}
