import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './common/services/prisma.service';
import { CategoriesModule } from './modules/categories/categories.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { IntakesModule } from './modules/intakes/intakes.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { SettingsModule } from './modules/settings/settings.module';
import { WebsocketModule } from './modules/websocket/websocket.module';

@Module({
  imports: [
    // Configuration module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Event emitter module
    EventEmitterModule.forRoot(),

    // Bull queue configuration
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),

    // Feature modules
    CategoriesModule,
    IntakesModule,
    QuestionsModule,
    ExtractionModule,
    SettingsModule,
    WebsocketModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
