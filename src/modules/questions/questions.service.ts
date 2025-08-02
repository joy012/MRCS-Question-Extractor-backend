import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Question, QuestionStatus } from '@prisma/client';
import { PaginatedResponseDto } from '../../common/dto';
import { PrismaService } from '../../common/services/prisma.service';
import { CategoriesService } from '../categories/categories.service';
import { IntakesService } from '../intakes/intakes.service';
import { CreateQuestionDto, QuestionFilterDto, UpdateQuestionDto } from './dto';

export interface QuestionFilters {
  categories?: string[];
  year?: number;
  intake?: string;
  status?: QuestionStatus;
  search?: string;
  minConfidence?: number;
}

export interface QuestionStats {
  total: number;
  byCategory: Record<string, number>;
  byYear: Record<number, number>;
  byIntake: Record<string, number>;
  byStatus: Record<QuestionStatus, number>;
  averageConfidence: number;
}

@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly categoriesService: CategoriesService,
    private readonly intakesService: IntakesService,
  ) {}

  async create(createQuestionDto: CreateQuestionDto): Promise<Question> {
    try {
      // Validate categories exist
      const categoryEntities = await this.prisma.category.findMany({
        where: { id: { in: createQuestionDto.categories } },
      });

      if (categoryEntities.length !== createQuestionDto.categories.length) {
        throw new NotFoundException('One or more categories not found');
      }

      // Validate intake exists
      const intakeEntity = await this.prisma.intake.findUnique({
        where: { id: createQuestionDto.intake },
      });

      if (!intakeEntity) {
        throw new NotFoundException('Intake not found');
      }

      const {
        intake: intakeId,
        categories: categoryIds,
        ...questionData
      } = createQuestionDto;
      const createdQuestion = await this.prisma.question.create({
        data: {
          ...questionData,
          status: QuestionStatus.PENDING,
          intakeId: intakeId,
          categoryIds: categoryIds,
        },
        include: {
          intake: true,
        },
      });

      // Update question counts
      await Promise.all([
        this.categoriesService.updateQuestionCount(createQuestionDto.intake, 1),
        this.intakesService.updateQuestionCount(createQuestionDto.intake, 1),
      ]);

      return createdQuestion;
    } catch (error) {
      this.logger.error('Failed to create question:', error);
      throw error;
    }
  }

  async findAll(
    filters?: QuestionFilterDto,
  ): Promise<PaginatedResponseDto<Question>> {
    const {
      page = 1,
      limit = 20,
      search,
      categories,
      year,
      intake,
      status,
      minConfidence,
    } = filters || {};

    const skip = (page - 1) * limit;

    const where: any = {
      isDeleted: false,
    };

    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { explanation: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (categories && categories.length > 0) {
      where.categoryIds = {
        hasSome: categories,
      };
    }

    if (year) {
      where.year = year;
    }

    if (intake) {
      where.intakeId = intake;
    }

    if (status) {
      where.status = status;
    }

    if (minConfidence !== undefined) {
      where.aiMetadata = {
        path: ['confidence'],
        gte: minConfidence,
      };
    }

    const [questions, total] = await Promise.all([
      this.prisma.question.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          intake: true,
        },
      }),
      this.prisma.question.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: questions,
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

  async findOne(id: string): Promise<Question | null> {
    return this.prisma.question.findUnique({
      where: { id },
      include: {
        intake: true,
      },
    });
  }

  async update(
    id: string,
    updateQuestionDto: UpdateQuestionDto,
  ): Promise<Question | null> {
    try {
      const existingQuestion = await this.prisma.question.findUnique({
        where: { id },
      });

      if (!existingQuestion) {
        throw new NotFoundException(`Question with ID ${id} not found`);
      }

      // Validate categories if provided
      if (updateQuestionDto.categories) {
        const categories = await this.prisma.category.findMany({
          where: { id: { in: updateQuestionDto.categories } },
        });

        if (categories.length !== updateQuestionDto.categories.length) {
          throw new NotFoundException('One or more categories not found');
        }
      }

      // Validate intake if provided
      if (updateQuestionDto.intake) {
        const intake = await this.prisma.intake.findUnique({
          where: { id: updateQuestionDto.intake },
        });

        if (!intake) {
          throw new NotFoundException('Intake not found');
        }
      }

      const { intake, categories, ...updateData } = updateQuestionDto;
      return await this.prisma.question.update({
        where: { id },
        data: {
          ...updateData,
          ...(intake && { intakeId: intake }),
          ...(categories && { categoryIds: categories }),
        },
        include: {
          intake: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update question ${id}:`, error);
      throw error;
    }
  }

  async remove(id: string): Promise<boolean> {
    try {
      await this.prisma.question.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete question ${id}:`, error);
      return false;
    }
  }

  async getStatistics(): Promise<QuestionStats> {
    const [total, byCategory, byYear, byIntake, byStatus, averageConfidence] =
      await Promise.all([
        this.prisma.question.count({ where: { isDeleted: false } }),
        this.getCategoryStats(),
        this.getYearStats(),
        this.getIntakeStats(),
        this.getStatusStats(),
        this.getAverageConfidence(),
      ]);

    return {
      total,
      byCategory,
      byYear,
      byIntake,
      byStatus,
      averageConfidence,
    };
  }

  async getCategories(): Promise<Array<{ category: string; count: number }>> {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    // Get question counts for each category
    const categoryStats = await this.prisma.question.groupBy({
      by: ['categoryIds'],
      _count: true,
      where: { isDeleted: false },
    });

    return categories.map((cat) => {
      const count =
        categoryStats.find((stat) => stat.categoryIds.includes(cat.id))
          ?._count || 0;
      return {
        category: cat.name,
        count,
      };
    });
  }

  async getYears(): Promise<Array<{ year: number; count: number }>> {
    const years = await this.prisma.question.findMany({
      where: { isDeleted: false },
      select: { year: true },
      distinct: ['year'],
    });

    // Get question counts for each year
    const yearStats = await this.prisma.question.groupBy({
      by: ['year'],
      _count: true,
      where: { isDeleted: false },
    });

    return years
      .map((y) => y.year)
      .sort()
      .map((year) => {
        const count = yearStats.find((stat) => stat.year === year)?._count || 0;
        return {
          year,
          count,
        };
      });
  }

  async getIntakes(): Promise<Array<{ intake: string; count: number }>> {
    const intakes = await this.prisma.intake.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    // Get question counts for each intake
    const intakeStats = await this.prisma.question.groupBy({
      by: ['intakeId'],
      _count: true,
      where: { isDeleted: false },
    });

    return intakes.map((intake) => {
      const count =
        intakeStats.find((stat) => stat.intakeId === intake.id)?._count || 0;
      return {
        intake: intake.name,
        count,
      };
    });
  }

  async bulkCreate(questions: CreateQuestionDto[]): Promise<{
    created: number;
    skipped: number;
    errors: string[];
  }> {
    const result: { created: number; skipped: number; errors: string[] } = {
      created: 0,
      skipped: 0,
      errors: [],
    };

    for (const questionDto of questions) {
      try {
        await this.create(questionDto);
        result.created++;
      } catch (error) {
        result.errors.push(
          `Failed to create question: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        result.skipped++;
      }
    }

    return result;
  }

  async updateStatus(
    id: string,
    status: QuestionStatus,
  ): Promise<Question | null> {
    try {
      return await this.prisma.question.update({
        where: { id },
        data: { status },
        include: {
          intake: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update status for question ${id}:`, error);
      return null;
    }
  }

  async bulkUpdateStatus(
    ids: string[],
    status: QuestionStatus,
  ): Promise<{ updated: number; errors: string[] }> {
    const result: { updated: number; errors: string[] } = {
      updated: 0,
      errors: [],
    };

    for (const id of ids) {
      try {
        await this.updateStatus(id, status);
        result.updated++;
      } catch (error) {
        result.errors.push(
          `Failed to update question ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return result;
  }

  private async getCategoryStats(): Promise<Record<string, number>> {
    const stats = await this.prisma.question.groupBy({
      by: ['categoryIds'],
      _count: true,
      where: { isDeleted: false },
    });

    const categoryStats: Record<string, number> = {};
    for (const stat of stats) {
      for (const categoryId of stat.categoryIds) {
        categoryStats[categoryId] =
          (categoryStats[categoryId] || 0) + stat._count;
      }
    }

    return categoryStats;
  }

  private async getYearStats(): Promise<Record<number, number>> {
    const stats = await this.prisma.question.groupBy({
      by: ['year'],
      _count: true,
      where: { isDeleted: false },
    });

    return stats.reduce(
      (acc, stat) => {
        acc[stat.year] = stat._count;
        return acc;
      },
      {} as Record<number, number>,
    );
  }

  private async getIntakeStats(): Promise<Record<string, number>> {
    const stats = await this.prisma.question.groupBy({
      by: ['intakeId'],
      _count: true,
      where: { isDeleted: false },
    });

    return stats.reduce(
      (acc, stat) => {
        acc[stat.intakeId] = stat._count;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private async getStatusStats(): Promise<Record<QuestionStatus, number>> {
    const stats = await this.prisma.question.groupBy({
      by: ['status'],
      _count: true,
      where: { isDeleted: false },
    });

    // Initialize with all possible status values
    const result: Record<QuestionStatus, number> = {
      PENDING: 0,
      APPROVED: 0,
      REJECTED: 0,
    };

    // Fill in actual counts
    stats.forEach((stat) => {
      result[stat.status] = stat._count;
    });

    return result;
  }

  private async getAverageConfidence(): Promise<number> {
    try {
      // Get all questions with AI metadata
      const questions = await this.prisma.question.findMany({
        where: {
          isDeleted: false,
        },
        select: {
          aiMetadata: true,
        },
      });

      // Extract confidence values from AI metadata
      const confidenceValues: number[] = [];

      for (const question of questions) {
        if (question.aiMetadata && typeof question.aiMetadata === 'object') {
          const aiMetadata = question.aiMetadata as any;
          if (
            aiMetadata.confidence !== undefined &&
            aiMetadata.confidence !== null
          ) {
            const confidence = Number(aiMetadata.confidence);
            if (!isNaN(confidence) && confidence >= 0 && confidence <= 100) {
              confidenceValues.push(confidence);
            }
          }
        }
      }

      // Calculate average confidence
      if (confidenceValues.length === 0) {
        return 0;
      }

      const totalConfidence = confidenceValues.reduce(
        (sum, confidence) => sum + confidence,
        0,
      );
      const averageConfidence = totalConfidence / confidenceValues.length;

      // Round to 2 decimal places
      return Math.round(averageConfidence * 100) / 100;
    } catch (error) {
      this.logger.error('Failed to calculate average confidence:', error);
      return 0;
    }
  }
}
