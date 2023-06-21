import {
  OnQueueActive,
  OnQueueCompleted,
  OnQueueError,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import * as util from 'util';
import {
  COINGECKO_API,
  CONTRACT_CODE_RESULT,
  CONTRACT_CODE_STATUS,
  CONTRACT_TYPE,
  INDEXER_API,
  MAINNET_UPLOAD_STATUS,
  REDIS_KEY,
  SMART_CONTRACT_VERIFICATION,
  SOULBOUND_TOKEN_STATUS,
  SOULBOUND_PICKED_TOKEN,
  QUEUES,
  COIN_MARKET_CAP_API,
} from '../common/constants/app.constant';
import { SmartContract, TokenMarkets } from '../entities';
import { SyncDataHelpers } from '../helpers/sync-data.helpers';
import { DeploymentRequestsRepository } from '../repositories/deployment-requests.repository';
import { SmartContractCodeRepository } from '../repositories/smart-contract-code.repository';
import { SmartContractRepository } from '../repositories/smart-contract.repository';
import { TokenMarketsRepository } from '../repositories/token-markets.repository';
import { ConfigService, ENV_CONFIG } from '../shared/services/config.service';
import { CommonUtil } from '../utils/common.util';
import { RedisUtil } from '../utils/redis.util';

import { HttpService } from '@nestjs/axios';
import { In } from 'typeorm';
import { InfluxDBClient } from '../utils/influxdb-client';
import { SoulboundTokenRepository } from '../repositories/soulbound-token.repository';
import { SoulboundToken } from '../entities/soulbound-token.entity';
import { lastValueFrom, timeout, retry } from 'rxjs';

@Processor('smart-contracts')
export class SmartContractsProcessor {}
