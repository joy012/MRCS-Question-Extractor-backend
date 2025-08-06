import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class GetQuestionsQueryDto {
  @ApiProperty({ description: 'Page number', required: false, type: Number })
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    type: Number,
  })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiProperty({
    description: 'Filter by status',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsString()
  status?: string;
}
