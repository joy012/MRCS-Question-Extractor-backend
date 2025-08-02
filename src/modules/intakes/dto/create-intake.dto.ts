import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { IntakeType } from '../../../common/CONSTANTS';

export class CreateIntakeDto {
  @ApiProperty({
    description: 'Unique intake name (slug)',
    example: 'january',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Intake type',
    enum: IntakeType,
    example: IntakeType.JANUARY,
  })
  @IsEnum(IntakeType)
  type: IntakeType;

  @ApiProperty({
    description: 'Display name for the intake',
    example: 'January',
  })
  @IsString()
  displayName: string;

  @ApiPropertyOptional({
    description: 'Whether the intake is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
