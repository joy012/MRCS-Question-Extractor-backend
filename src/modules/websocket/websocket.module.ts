import { Module } from '@nestjs/common';
import { ExtractionGateway } from './extraction.gateway';
import { ExtractionModule } from '../extraction/extraction.module';

@Module({
  imports: [ExtractionModule],
  providers: [ExtractionGateway],
  exports: [ExtractionGateway],
})
export class WebsocketModule {} 