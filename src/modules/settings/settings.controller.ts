import { TypedRoute } from '@nestia/core';
import { Controller } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { DeleteFullDatabaseResponse, DeleteQuestionsResponse } from './dto';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @TypedRoute.Post('delete-database')
  async deleteFullDatabase(): Promise<DeleteFullDatabaseResponse> {
    return await this.settingsService.deleteFullDatabase();
  }

  @TypedRoute.Post('delete-questions')
  async deleteQuestions(): Promise<DeleteQuestionsResponse> {
    return await this.settingsService.deleteQuestions();
  }
}
