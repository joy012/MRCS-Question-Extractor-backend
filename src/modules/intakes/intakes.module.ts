import { Module } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { IntakesController } from './intakes.controller';
import { IntakesService } from './intakes.service';

@Module({
  controllers: [IntakesController],
  providers: [IntakesService, PrismaService],
  exports: [IntakesService],
})
export class IntakesModule {}
