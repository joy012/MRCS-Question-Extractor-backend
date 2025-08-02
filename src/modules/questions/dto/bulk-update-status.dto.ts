import { IsArray, IsEnum, IsString } from 'class-validator';
import { QuestionStatus } from '../../../common/CONSTANTS';

export class BulkUpdateStatusDto {
  @IsArray()
  @IsString({ each: true })
  ids: string[];

  @IsEnum(QuestionStatus)
  status: QuestionStatus;
}
