import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from './shared/services/config.service';
import { SharedModule } from './shared/shared.module';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import * as Queue from 'bull';
import { getBullBoardQueues } from './controllers/bull-board-queue';
import { BaseAdapter } from '@bull-board/api/dist/src/queueAdapters/base';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // enable cors
  app.enableCors();

  const configService = app.select(SharedModule).get(ConfigService);

  //bull board

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const queues = getBullBoardQueues();

  const { addQueue, removeQueue, setQueues, replaceQueues } = createBullBoard({
    queues: [],
    serverAdapter: serverAdapter,
  });

  queues.forEach((queue: BaseAdapter) => {
    addQueue(queue);
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  //setup swagger
  const config = new DocumentBuilder()
    .setTitle('Aura Explorer Sync API')
    .setVersion('0.1')
    .addServer('/')
    .addServer(configService.get('SWAGGER_PATH'))
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('documentation', app, document);

  await app.listen(configService.get('APP_PORT'));
}
bootstrap();
