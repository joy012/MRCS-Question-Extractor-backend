import { Category } from '@prisma/client';
import { CategoryType } from '../../../common/CONSTANTS';
import { PaginatedResponseDto } from '../../../common/dto';

export type FindAllCategoriesResponse = PaginatedResponseDto<Category>;
export type FindAllActiveCategoriesResponse = Category[];
export type FindByIdCategoryResponse = Category | null;
export type CreateCategoryResponse = Category;
export type UpdateCategoryResponse = Category | null;
export type DeleteCategoryResponse = void;
export type ResetToDefaultResponse = { message: string };
export type FindBasicCategoriesResponse = Category[];
export type FindClinicalCategoriesResponse = Category[];
export type GetCategoryStatsResponse = {
  total: number;
  active: number;
  byType: Record<CategoryType, number>;
};
export type GetActiveCategoryNamesResponse = string[];
export type SeedCategoriesResponse = { message: string };
