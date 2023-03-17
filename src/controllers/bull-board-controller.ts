import { createBullBoard } from '@bull-board/api';
import { BaseAdapter } from '@bull-board/api/dist/src/queueAdapters/base';
import { ExpressAdapter } from '@bull-board/express';
import {
  Request,
  Response,
  All,
  Controller,
  Next,
  Get,
  Post,
} from '@nestjs/common';

@Controller('/queues/admin')
export class BullBoardController {
  @All('*')
  admin() {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');
    const { addQueue } = createBullBoard({
      queues: [],
      serverAdapter,
    });
  }
}
