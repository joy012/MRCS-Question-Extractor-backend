import { INestiaConfig } from '@nestia/sdk';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

const config: INestiaConfig = {
  input: () => NestFactory.create(AppModule),
  output: './generated-api',

  swagger: {
    output: './swagger.json',
    security: {
      bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    info: {
      title: 'MRCS Question Extractor API',
      description:
        'AI-powered medical exam question extraction from PDF documents',
      version: '1.0.0',
    },
    beautify: true,
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
  },
};

export default config;
