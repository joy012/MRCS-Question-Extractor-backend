import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  async deleteFullDatabase(): Promise<{ message: string; timestamp: string }> {
    await this.prisma.question.deleteMany();
    await this.prisma.category.deleteMany();
    await this.prisma.intake.deleteMany();
    this.logger.log('Full database deleted');
    return {
      message: 'Full database deleted',
      timestamp: new Date().toISOString(),
    };
  }

  async deleteQuestions(): Promise<{ message: string; timestamp: string }> {
    await this.prisma.question.deleteMany();
    this.logger.log('All questions deleted');
    return {
      message: 'All questions deleted',
      timestamp: new Date().toISOString(),
    };
  }
}
