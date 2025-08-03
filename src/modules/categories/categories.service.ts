import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Category, CategoryType } from '@prisma/client';
import { DEFAULT_CATEGORIES } from '../../common/CONSTANTS';
import { PaginatedResponseDto } from '../../common/dto';
import { PrismaService } from '../../common/services/prisma.service';
import { CategoryFilterDto, CreateCategoryDto, UpdateCategoryDto } from './dto';

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedCategories();
  }

  async seedCategories(): Promise<void> {
    try {
      this.logger.log('Checking if categories need to be seeded...');

      const existingCategories = await this.prisma.category.count();

      if (existingCategories === 0) {
        this.logger.log('No categories found. Seeding default categories...');

        const categoriesToInsert = DEFAULT_CATEGORIES.map((cat) => ({
          name: cat.name,
          displayName: cat.displayName,
          type: cat.type,
          questionCount: 0,
          isActive: true,
        }));

        await this.prisma.category.createMany({
          data: categoriesToInsert,
        });

        this.logger.log(
          `✅ Successfully seeded ${categoriesToInsert.length} categories`,
        );
      } else {
        this.logger.log(
          `✅ Categories already exist (${existingCategories} found). Skipping seeding.`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to seed categories:', error);
      throw error;
    }
  }

  async findAll(
    filters?: CategoryFilterDto,
  ): Promise<PaginatedResponseDto<Category>> {
    const { page = 1, limit = 10, search, type, isActive } = filters || {};

    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type !== undefined) {
      where.type = type;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    } else {
      where.isActive = true; // Default to active categories only
    }

    const [categories, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ displayName: 'asc' }],
      }),
      this.prisma.category.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: categories,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findAllActive(): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ displayName: 'asc' }],
    });
  }

  async findById(id: string): Promise<Category | null> {
    return this.prisma.category.findUnique({
      where: { id },
    });
  }

  async findByType(type: CategoryType): Promise<Category[]> {
    return this.prisma.category.findMany({
      where: { type, isActive: true },
      orderBy: [{ displayName: 'asc' }],
    });
  }

  async findByName(name: string): Promise<Category | null> {
    return this.prisma.category.findUnique({
      where: { name },
    });
  }

  async getActiveCategoryNames(): Promise<string[]> {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: { name: true },
    });
    return categories.map((cat) => cat.name);
  }

  async getCategoryStats(): Promise<{
    total: number;
    active: number;
    byType: Record<CategoryType, number>;
  }> {
    const [total, active, basicCount, clinicalCount] = await Promise.all([
      this.prisma.category.count(),
      this.prisma.category.count({ where: { isActive: true } }),
      this.prisma.category.count({
        where: { type: CategoryType.BASIC, isActive: true },
      }),
      this.prisma.category.count({
        where: { type: CategoryType.CLINICAL, isActive: true },
      }),
    ]);

    return {
      total,
      active,
      byType: {
        [CategoryType.BASIC]: basicCount,
        [CategoryType.CLINICAL]: clinicalCount,
      },
    };
  }

  async create(createCategoryDto: CreateCategoryDto): Promise<Category> {
    return this.prisma.category.create({
      data: createCategoryDto,
    });
  }

  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category | null> {
    return this.prisma.category.update({
      where: { id },
      data: updateCategoryDto,
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.category.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete category ${id}:`, error);
      return false;
    }
  }

  async resetToDefault(): Promise<void> {
    try {
      // Delete all existing categories
      await this.prisma.category.deleteMany({});

      // Seed with default categories
      await this.seedCategories();

      this.logger.log('✅ Categories reset to default successfully');
    } catch (error) {
      this.logger.error('Failed to reset categories:', error);
      throw error;
    }
  }

  async deactivate(id: string): Promise<Category | null> {
    return this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activate(id: string): Promise<Category | null> {
    return this.prisma.category.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async updateQuestionCount(
    categoryId: string,
    increment: number = 1,
  ): Promise<void> {
    try {
      // First check if the category exists
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        this.logger.warn(
          `Category ${categoryId} not found, skipping question count update`,
        );
        return;
      }

      await this.prisma.category.update({
        where: { id: categoryId },
        data: {
          questionCount: {
            increment,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update question count for category ${categoryId}:`,
        error,
      );
    }
  }

  async syncQuestionCounts(): Promise<void> {
    try {
      // Get all categories
      const categories = await this.prisma.category.findMany({
        select: { id: true },
      });

      // Update question count for each category
      for (const category of categories) {
        const count = await this.prisma.question.count({
          where: {
            categoryIds: {
              has: category.id,
            },
            isDeleted: false,
          },
        });

        await this.prisma.category.update({
          where: { id: category.id },
          data: { questionCount: count },
        });
      }

      this.logger.log('✅ Question counts synced successfully');
    } catch (error) {
      this.logger.error('Failed to sync question counts:', error);
      throw error;
    }
  }
}
