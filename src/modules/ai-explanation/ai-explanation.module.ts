import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ExtractionModule } from '../extraction/extraction.module';
import { AiExplanationController } from './ai-explanation.controller';
import { AiExplanationService } from './ai-explanation.service';

@Module({
  imports: [ExtractionModule],
  controllers: [AiExplanationController],
  providers: [AiExplanationService, PrismaService],
  exports: [AiExplanationService],
})
export class AiExplanationModule {}
