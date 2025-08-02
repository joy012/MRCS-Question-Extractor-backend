import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CategoriesModule } from '../categories/categories.module';
import { IntakesModule } from '../intakes/intakes.module';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  imports: [CategoriesModule, IntakesModule],
  controllers: [QuestionsController],
  providers: [QuestionsService, PrismaService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
