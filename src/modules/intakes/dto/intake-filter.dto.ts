import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { IntakeType } from '../../../common/CONSTANTS';
import { SearchDto } from '../../../common/dto';

export class IntakeFilterDto extends SearchDto {
  @ApiPropertyOptional({
    description: 'Filter by intake type',
    enum: IntakeType,
  })
  @IsOptional()
  @IsEnum(IntakeType)
  type?: IntakeType;

  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
