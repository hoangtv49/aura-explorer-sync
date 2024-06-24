import { Injectable, Logger } from '@nestjs/common';
import { QUEUES } from '../common/constants/app.constant';
import { CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class SyncSmartContractService {
  private readonly logger = new Logger(SyncSmartContractService.name);

  constructor(
    @InjectQueue('smart-contracts') private readonly contractQueue: Queue,
  ) {
    this.logger.log(
      '============== Constructor Sync Smart Contract Service ==============',
    );

    this.contractQueue.add(
      QUEUES.SYNC_CONTRACT_FROM_HEIGHT,
      {},
      {
        repeat: {
          cron: CronExpression.EVERY_5_SECONDS,
        },
        backoff: {
          type: 'exponential',
          delay: 0,
        },
      },
    );
  }
}
