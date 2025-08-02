import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { QuestionsModule } from '../questions/questions.module';
import { ExtractionController } from './extraction.controller';
import { ExtractionService } from './extraction.service';
import { OllamaService } from './ollama.service';
import { PdfService } from './pdf.service';

@Module({
  imports: [QuestionsModule],
  controllers: [ExtractionController],
  providers: [ExtractionService, PdfService, OllamaService, PrismaService],
  exports: [ExtractionService, PdfService, OllamaService],
})
export class ExtractionModule {}
