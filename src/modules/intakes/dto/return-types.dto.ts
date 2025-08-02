import { Intake } from '@prisma/client';
import { PaginatedResponseDto } from '../../../common/dto';

export type FindAllIntakesResponse = PaginatedResponseDto<Intake>;
export type FindAllActiveIntakesResponse = Intake[];
export type FindByIdIntakeResponse = Intake | null;
export type CreateIntakeResponse = Intake;
export type UpdateIntakeResponse = Intake | null;
export type DeleteIntakeResponse = void;
export type ResetToDefaultResponse = { message: string };
