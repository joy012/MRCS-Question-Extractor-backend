import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Intake, IntakeType } from '@prisma/client';
import { DEFAULT_INTAKES } from '../../common/CONSTANTS';
import { PaginatedResponseDto } from '../../common/dto';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateIntakeDto, IntakeFilterDto, UpdateIntakeDto } from './dto';

@Injectable()
export class IntakesService implements OnModuleInit {
  private readonly logger = new Logger(IntakesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedIntakes();
  }

  async seedIntakes(): Promise<void> {
    try {
      this.logger.log('Checking if intakes need to be seeded...');

      const existingIntakes = await this.prisma.intake.count();

      if (existingIntakes === 0) {
        this.logger.log('No intakes found. Seeding default intakes...');

        const intakesToInsert = DEFAULT_INTAKES.map((intake) => ({
          name: intake.name,
          type: intake.type,
          displayName: intake.displayName,
          questionCount: 0,
          isActive: true,
        }));

        await this.prisma.intake.createMany({
          data: intakesToInsert,
        });

        this.logger.log(
          `✅ Successfully seeded ${intakesToInsert.length} intakes`,
        );
      } else {
        this.logger.log(
          `✅ Intakes already exist (${existingIntakes} found). Skipping seeding.`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to seed intakes:', error);
      throw error;
    }
  }

  async findAll(
    filters?: IntakeFilterDto,
  ): Promise<PaginatedResponseDto<Intake>> {
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
      where.isActive = true; // Default to active intakes only
    }

    const [intakes, total] = await Promise.all([
      this.prisma.intake.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ displayName: 'asc' }],
      }),
      this.prisma.intake.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      data: intakes,
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

  async findAllActive(): Promise<Intake[]> {
    return this.prisma.intake.findMany({
      where: { isActive: true },
      orderBy: [{ displayName: 'asc' }],
    });
  }

  async findById(id: string): Promise<Intake | null> {
    return this.prisma.intake.findUnique({
      where: { id },
    });
  }

  async findByType(type: IntakeType): Promise<Intake[]> {
    return this.prisma.intake.findMany({
      where: { type, isActive: true },
      orderBy: [{ displayName: 'asc' }],
    });
  }

  async findByName(name: string): Promise<Intake | null> {
    return this.prisma.intake.findUnique({
      where: { name },
    });
  }

  async getActiveIntakeNames(): Promise<string[]> {
    const intakes = await this.prisma.intake.findMany({
      where: { isActive: true },
      select: { name: true },
    });
    return intakes.map((intake) => intake.name);
  }

  async getIntakeStats(): Promise<{
    total: number;
    active: number;
    byType: Record<IntakeType, number>;
  }> {
    const [total, active, januaryCount, aprilMayCount, septemberCount] =
      await Promise.all([
        this.prisma.intake.count(),
        this.prisma.intake.count({ where: { isActive: true } }),
        this.prisma.intake.count({
          where: { type: IntakeType.JANUARY, isActive: true },
        }),
        this.prisma.intake.count({
          where: { type: IntakeType.APRIL_MAY, isActive: true },
        }),
        this.prisma.intake.count({
          where: { type: IntakeType.SEPTEMBER, isActive: true },
        }),
      ]);

    return {
      total,
      active,
      byType: {
        [IntakeType.JANUARY]: januaryCount,
        [IntakeType.APRIL_MAY]: aprilMayCount,
        [IntakeType.SEPTEMBER]: septemberCount,
      },
    };
  }

  async create(createIntakeDto: CreateIntakeDto): Promise<Intake> {
    return this.prisma.intake.create({
      data: createIntakeDto,
    });
  }

  async update(
    id: string,
    updateIntakeDto: UpdateIntakeDto,
  ): Promise<Intake | null> {
    return this.prisma.intake.update({
      where: { id },
      data: updateIntakeDto,
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.intake.delete({
        where: { id },
      });
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete intake ${id}:`, error);
      return false;
    }
  }

  async resetToDefault(): Promise<void> {
    try {
      // Delete all existing intakes
      await this.prisma.intake.deleteMany({});

      // Seed with default intakes
      await this.seedIntakes();

      this.logger.log('✅ Intakes reset to default successfully');
    } catch (error) {
      this.logger.error('Failed to reset intakes:', error);
      throw error;
    }
  }

  async deactivate(id: string): Promise<Intake | null> {
    return this.prisma.intake.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async activate(id: string): Promise<Intake | null> {
    return this.prisma.intake.update({
      where: { id },
      data: { isActive: true },
    });
  }

  async getQuestionCount(intakeId: string): Promise<number> {
    return this.prisma.question.count({
      where: {
        intakeId,
        isDeleted: false,
      },
    });
  }

  async updateQuestionCount(
    intakeId: string,
    increment: number = 1,
  ): Promise<void> {
    try {
      // First check if the intake exists
      const intake = await this.prisma.intake.findUnique({
        where: { id: intakeId },
      });

      if (!intake) {
        this.logger.warn(`Intake ${intakeId} not found, skipping question count update`);
        return;
      }

      await this.prisma.intake.update({
        where: { id: intakeId },
        data: {
          questionCount: {
            increment,
          },
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to update question count for intake ${intakeId}:`,
        error,
      );
    }
  }

  async syncQuestionCounts(): Promise<void> {
    try {
      // Get all intakes
      const intakes = await this.prisma.intake.findMany({
        select: { id: true },
      });

      // Update question count for each intake
      for (const intake of intakes) {
        const count = await this.prisma.question.count({
          where: {
            intakeId: intake.id,
            isDeleted: false,
          },
        });

        await this.prisma.intake.update({
          where: { id: intake.id },
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
