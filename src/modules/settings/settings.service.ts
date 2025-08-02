import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ExtractionStateDto, ExtractionStatus } from './dto';

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

  // Get extraction state from database
  async getExtractionState(): Promise<ExtractionStateDto | null> {
    try {
      const setting = await this.prisma.settings.findUnique({
        where: { key: 'extraction_state' },
      });

      if (!setting) {
        return null;
      }

      // Parse the JSON value and validate it
      const parsedValue = setting.value as any;
      if (!parsedValue || typeof parsedValue !== 'object') {
        return null;
      }

      // Convert to DTO format
      return {
        status: parsedValue.status || ExtractionStatus.IDLE,
        selectedPdf: parsedValue.selectedPdf || '',
        progress: parsedValue.progress || 0,
        totalPages: parsedValue.totalPages || 0,
        processedPages: parsedValue.processedPages || 0,
        failedPages: parsedValue.failedPages || [],
        logs: parsedValue.logs || [],
        startTime: parsedValue.startTime,
        endTime: parsedValue.endTime,
        error: parsedValue.error,
        extractedQuestions: parsedValue.extractedQuestions || 0,
        questionsPerPage: parsedValue.questionsPerPage || {},
        verifiedQuestions: parsedValue.verifiedQuestions || 0,
        updatedQuestions: parsedValue.updatedQuestions || 0,
        skippedQuestions: parsedValue.skippedQuestions || 0,
        extractionId: parsedValue.extractionId,
        model: parsedValue.model,
        startPage: parsedValue.startPage,
        maxPages: parsedValue.maxPages,
        overwrite: parsedValue.overwrite,
      };
    } catch (error) {
      this.logger.error('Error getting extraction state:', error);
      return null;
    }
  }

  // Save extraction state to database
  async saveExtractionState(state: ExtractionStateDto): Promise<void> {
    try {
      // Convert DTO to plain object for JSON storage
      const stateObject = {
        status: state.status,
        selectedPdf: state.selectedPdf,
        progress: state.progress,
        totalPages: state.totalPages,
        processedPages: state.processedPages,
        failedPages: state.failedPages,
        logs: state.logs,
        startTime: state.startTime,
        endTime: state.endTime,
        error: state.error,
        extractedQuestions: state.extractedQuestions,
        questionsPerPage: state.questionsPerPage,
        verifiedQuestions: state.verifiedQuestions,
        updatedQuestions: state.updatedQuestions,
        skippedQuestions: state.skippedQuestions,
        extractionId: state.extractionId,
        model: state.model,
        startPage: state.startPage,
        maxPages: state.maxPages,
        overwrite: state.overwrite,
      };

      await this.prisma.settings.upsert({
        where: { key: 'extraction_state' },
        update: {
          value: stateObject,
          updatedAt: new Date(),
        },
        create: {
          key: 'extraction_state',
          value: stateObject,
          description: 'Current extraction state and progress',
        },
      });
    } catch (error) {
      this.logger.error('Error saving extraction state:', error);
      throw error;
    }
  }

  // Clear extraction state
  async clearExtractionState(): Promise<void> {
    try {
      await this.prisma.settings.deleteMany({
        where: { key: 'extraction_state' },
      });
    } catch (error) {
      this.logger.error('Error clearing extraction state:', error);
      throw error;
    }
  }

  // Get application settings
  async getSetting(key: string): Promise<any> {
    try {
      const setting = await this.prisma.settings.findUnique({
        where: { key },
      });

      return setting?.value || null;
    } catch (error) {
      this.logger.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  // Save application setting
  async saveSetting(
    key: string,
    value: any,
    description?: string,
  ): Promise<void> {
    try {
      await this.prisma.settings.upsert({
        where: { key },
        update: {
          value,
          updatedAt: new Date(),
        },
        create: {
          key,
          value,
          description,
        },
      });
    } catch (error) {
      this.logger.error(`Error saving setting ${key}:`, error);
      throw error;
    }
  }

  // Get all settings
  async getAllSettings(): Promise<Record<string, any>> {
    try {
      const settings = await this.prisma.settings.findMany();
      const result: Record<string, any> = {};

      for (const setting of settings) {
        result[setting.key] = setting.value;
      }

      return result;
    } catch (error) {
      this.logger.error('Error getting all settings:', error);
      return {};
    }
  }
}
