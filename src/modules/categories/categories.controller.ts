import { TypedBody, TypedParam, TypedRoute } from '@nestia/core';
import { Controller, HttpCode, HttpStatus } from '@nestjs/common';
import { CategoryType } from '../../common/CONSTANTS';
import { CategoriesService } from './categories.service';
import {
  CreateCategoryResponse,
  DeleteCategoryResponse,
  FindAllActiveCategoriesResponse,
  FindAllCategoriesResponse,
  FindBasicCategoriesResponse,
  FindByIdCategoryResponse,
  FindClinicalCategoriesResponse,
  GetActiveCategoryNamesResponse,
  GetCategoryStatsResponse,
  ResetToDefaultResponse,
  SeedCategoriesResponse,
  UpdateCategoryResponse,
} from './dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * Get all active categories with pagination and filtering
   * @summary Get all active categories
   * @tag categories
   */
  @TypedRoute.Get()
  async findAll(): Promise<FindAllCategoriesResponse> {
    return this.categoriesService.findAll();
  }

  /**
   * Get all active categories without pagination
   * @summary Get all active categories
   * @tag categories
   */
  @TypedRoute.Get('all')
  async findAllActive(): Promise<FindAllActiveCategoriesResponse> {
    return this.categoriesService.findAllActive();
  }

  /**
   * Get category by ID
   * @summary Get category by ID
   * @tag categories
   */
  @TypedRoute.Get(':id')
  async findById(
    @TypedParam('id') id: string,
  ): Promise<FindByIdCategoryResponse> {
    return this.categoriesService.findById(id);
  }

  /**
   * Create a new category
   * @summary Create a new category
   * @tag categories
   */
  @TypedRoute.Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @TypedBody() createCategoryDto: CreateCategoryDto,
  ): Promise<CreateCategoryResponse> {
    return this.categoriesService.create(createCategoryDto);
  }

  /**
   * Update a category
   * @summary Update a category
   * @tag categories
   */
  @TypedRoute.Put(':id')
  async update(
    @TypedParam('id') id: string,
    @TypedBody() updateCategoryDto: UpdateCategoryDto,
  ): Promise<UpdateCategoryResponse> {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  /**
   * Delete a category (only custom categories can be deleted)
   * @summary Delete a category
   * @tag categories
   */
  @TypedRoute.Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@TypedParam('id') id: string): Promise<DeleteCategoryResponse> {
    await this.categoriesService.delete(id);
  }

  /**
   * Reset categories to default (preseeded)
   * @summary Reset categories to default
   * @tag categories
   */
  @TypedRoute.Post('reset')
  async resetToDefault(): Promise<ResetToDefaultResponse> {
    await this.categoriesService.resetToDefault();
    return { message: 'Categories reset to default successfully' };
  }

  /**
   * Get all basic science categories
   * @summary Get all basic science categories
   * @tag categories
   */
  @TypedRoute.Get('basic')
  async findBasicCategories(): Promise<FindBasicCategoriesResponse> {
    return this.categoriesService.findByType(CategoryType.BASIC);
  }

  /**
   * Get all clinical categories
   * @summary Get all clinical categories
   * @tag categories
   */
  @TypedRoute.Get('clinical')
  async findClinicalCategories(): Promise<FindClinicalCategoriesResponse> {
    return this.categoriesService.findByType(CategoryType.CLINICAL);
  }

  /**
   * Get category statistics
   * @summary Get category statistics
   * @tag categories
   */
  @TypedRoute.Get('stats')
  async getCategoryStats(): Promise<GetCategoryStatsResponse> {
    return this.categoriesService.getCategoryStats();
  }

  /**
   * Get active category names
   * @summary Get active category names
   * @tag categories
   */
  @TypedRoute.Get('names')
  async getActiveCategoryNames(): Promise<GetActiveCategoryNamesResponse> {
    return this.categoriesService.getActiveCategoryNames();
  }

  /**
   * Manually trigger category seeding
   * @summary Manually trigger category seeding
   * @tag categories
   */
  @TypedRoute.Post('seed')
  async seedCategories(): Promise<SeedCategoriesResponse> {
    await this.categoriesService.seedCategories();
    return { message: 'Categories seeded successfully' };
  }
}
