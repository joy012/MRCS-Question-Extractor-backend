import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { CategoryType } from '../../../common/CONSTANTS';
import { SearchDto } from '../../../common/dto';

export class CategoryFilterDto extends SearchDto {
  @ApiPropertyOptional({
    description: 'Filter by category type',
    enum: CategoryType,
  })
  @IsOptional()
  @IsEnum(CategoryType)
  type?: CategoryType;

  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
