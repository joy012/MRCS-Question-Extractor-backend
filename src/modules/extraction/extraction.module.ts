import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { IntakesModule } from '../intakes/intakes.module';
import { QuestionsModule } from '../questions/questions.module';
import { SettingsModule } from '../settings/settings.module';
import { ExtractionController } from './extraction.controller';
import { ExtractionProcessor } from './extraction.processor';
import { ExtractionService } from './extraction.service';
import { OllamaService } from './ollama.service';
import { PdfService } from './pdf.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'extraction',
    }),
    CategoriesModule,
    IntakesModule,
    QuestionsModule,
    SettingsModule,
  ],
  controllers: [ExtractionController],
  providers: [
    ExtractionService,
    ExtractionProcessor,
    OllamaService,
    PdfService,
  ],
  exports: [ExtractionService, OllamaService],
})
export class ExtractionModule {}
