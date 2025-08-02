import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { CategoryType } from '../../../common/CONSTANTS';

export class CreateCategoryDto {
  @ApiProperty({
    description: 'Unique category name (slug)',
    example: 'anatomy',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Display name for the category',
    example: 'Anatomy',
  })
  @IsString()
  displayName: string;

  @ApiProperty({
    description: 'Category type',
    enum: CategoryType,
    example: CategoryType.BASIC,
  })
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiPropertyOptional({
    description: 'Whether the category is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
