import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ExtractionModule } from '../extraction/extraction.module';
import { AiRephrasingController } from './ai-rephrasing.controller';
import { AiRephrasingService } from './ai-rephrasing.service';

@Module({
  imports: [ExtractionModule],
  controllers: [AiRephrasingController],
  providers: [AiRephrasingService, PrismaService],
  exports: [AiRephrasingService],
})
export class AiRephrasingModule {}
