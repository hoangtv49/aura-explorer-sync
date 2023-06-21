import { InjectQueue, Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { CommonUtil } from '../utils/common.util';
import { TransactionRepository } from '../repositories/transaction.repository';
import { INDEXER_V2_API, QUEUES } from '../common/constants/app.constant';
import { TransactionHelper } from '../helpers/transaction.helper';
import { ENV_CONFIG } from '../shared/services/config.service';
import { CronExpression } from '@nestjs/schedule';
import * as util from 'util';

@Processor('transaction')
export class TransactionProcessor {}
