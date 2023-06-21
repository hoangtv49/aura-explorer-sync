import {
  InjectQueue,
  OnQueueError,
  OnQueueFailed,
  Process,
  Processor,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import {
  COINGECKO_API,
  COIN_MARKET_CAP_API,
  CONST_CHAR,
  INDEXER_V2_API,
  QUEUES,
  VOTING_POWER_LEVEL,
} from '../common/constants/app.constant';
import { SyncDataHelpers } from '../helpers/sync-data.helpers';
import { ValidatorRepository } from '../repositories/validator.repository';
import { ENV_CONFIG } from '../shared/services/config.service';
import { CommonUtil } from '../utils/common.util';
import * as util from 'util';
import { CronExpression } from '@nestjs/schedule';
import { TokenMarketsRepository } from '../repositories/token-markets.repository';
import { TokenMarkets } from 'src/entities';
import { In } from 'typeorm';
import { InfluxDBClient } from 'src/utils/influxdb-client';

@Processor(QUEUES.SYNC_COIN.QUEUE_NAME)
export class CoinProcessor {
  private readonly logger = new Logger(CoinProcessor.name);
  private influxDbClient: InfluxDBClient;

  constructor(
    private _commonUtil: CommonUtil,
    private tokenMarketsRepository: TokenMarketsRepository,
    @InjectQueue(QUEUES.SYNC_COIN.QUEUE_NAME) private readonly coinQueue: Queue,
  ) {
    this.logger.log('============== Constructor CoinProcessor ==============');
    this.connectInfluxdb();

    this.coinQueue.add(
      QUEUES.SYNC_COIN.JOBS.SYNC_PRICE,
      {},
      {
        repeat: { cron: QUEUES.SYNC_COIN.JOBS.TIME_SYNC },
      },
    );
  }

  @Process(QUEUES.SYNC_COIN.JOBS.SYNC_PRICE)
  async syncCW20TokensPrice() {
    try {
      const numberCW20Tokens =
        await this.tokenMarketsRepository.countCw20TokensHavingCoinId();
      const defaultTokens: string[] = ['aura-network', 'bitcoin'];
      const countData = numberCW20Tokens + defaultTokens.length;

      const limit = ENV_CONFIG.COINGECKO.MAX_REQUEST;
      const pages = Math.ceil((countData + defaultTokens.length) / limit);
      // for (let i = 0; i < pages; i++) {
      const dataHavingCoinId =
        await this.tokenMarketsRepository.getCw20TokenMarketsHavingCoinId(
          limit,
          0,
        );
      const tokensHavingCoinId = dataHavingCoinId?.map((i) => i.coin_id);
      // if (i === pages - 1) {
      //   tokensHavingCoinId.push(...defaultTokens);
      // }
      this.logger.log(tokensHavingCoinId);

      if (tokensHavingCoinId.length > 0) {
        this.logger.log(tokensHavingCoinId);
        await this.handleSyncPriceVolume(tokensHavingCoinId);
      }
      // }
    } catch (err) {
      throw Error(err);
    }
  }

  async handleSyncPriceVolume(listTokens) {
    try {
      if (ENV_CONFIG.PRICE_HOST_SYNC === 'COIN_MARKET_CAP') {
        this.syncCoinMarketCapPrice(listTokens);
      } else {
        this.syncCoingeckoPrice(listTokens);
      }
    } catch (err) {
      this.logger.log(`sync-price-volume has error: ${err.message}`, err.stack);
      // Reconnect influxDb
      // const errorCode = err?.code || '';
      // if (errorCode === 'ECONNREFUSED' || errorCode === 'ETIMEDOUT') {
      //   this.connectInfluxdb();
      // }
      throw err;
    }
  }

  async syncCoinMarketCapPrice(listTokens) {
    const coinMarketCap = ENV_CONFIG.COIN_MARKET_CAP;
    this.logger.log(`============== Call CoinMarketCap Api ==============`);
    const coinIds = ENV_CONFIG.COIN_MARKET_CAP.COIN_ID;
    const coinMarkets: TokenMarkets[] = [];

    const para = `${util.format(
      COIN_MARKET_CAP_API.GET_COINS_MARKET,
      coinIds,
    )}`;

    const headersRequest = {
      'Content-Type': 'application/json',
      'X-CMC_PRO_API_KEY': ENV_CONFIG.COIN_MARKET_CAP.API_KEY,
    };

    const [response, tokenInfos] = await Promise.all([
      this._commonUtil.getDataAPIWithHeader(
        coinMarketCap.API,
        para,
        headersRequest,
      ),
      this.tokenMarketsRepository.find({
        where: {
          coin_id: In(listTokens),
        },
      }),
    ]);

    if (response?.status?.error_code == 0 && response?.data) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const [key, value] of Object.entries(response?.data)) {
        const data = response?.data[key];
        let tokenInfo = tokenInfos?.find((f) => f.coin_id === data.slug);
        if (tokenInfo) {
          tokenInfo = SyncDataHelpers.updateCoinMarketsData(tokenInfo, data);
          coinMarkets.push(tokenInfo);
        }
      }
    }
    if (coinMarkets.length > 0) {
      await this.tokenMarketsRepository.update(coinMarkets);

      this.logger.log(`============== Write data to Influxdb ==============`);
      await this.influxDbClient.writeBlockTokenPriceAndVolume(coinMarkets);
      this.logger.log(
        `============== Write data to Influxdb  successfully ==============`,
      );
    }
  }

  async syncCoingeckoPrice(listTokens) {
    try {
      const coingecko = ENV_CONFIG.COINGECKO;
      this.logger.log(`============== Call Coingecko Api ==============`);
      const coinIds = listTokens.join(',');
      const coinMarkets: TokenMarkets[] = [];

      const para = `${util.format(
        COINGECKO_API.GET_COINS_MARKET,
        coinIds,
        coingecko.MAX_REQUEST,
      )}`;

      const [response, tokenInfos] = await Promise.all([
        this._commonUtil.getDataAPI(coingecko.API, para),
        this.tokenMarketsRepository.find({
          where: {
            coin_id: In(listTokens),
          },
        }),
      ]);

      if (response) {
        for (let index = 0; index < response.length; index++) {
          const data = response[index];
          let tokenInfo = tokenInfos?.find((f) => f.coin_id === data.id);
          if (tokenInfo) {
            tokenInfo = SyncDataHelpers.updateTokenMarketsData(tokenInfo, data);
            coinMarkets.push(tokenInfo);
          }
        }
      }
      if (coinMarkets.length > 0) {
        await this.tokenMarketsRepository.update(coinMarkets);

        this.logger.log(`============== Write data to Influxdb ==============`);
        await this.influxDbClient.writeBlockTokenPriceAndVolume(coinMarkets);
        this.logger.log(
          `============== Write data to Influxdb  successfully ==============`,
        );
      }
    } catch (err) {
      this.logger.log('1');
      throw Error('2');
    }
  }

  connectInfluxdb() {
    this.logger.log(
      `============== call connectInfluxdb method ==============`,
    );
    try {
      this.influxDbClient = new InfluxDBClient(
        ENV_CONFIG.INFLUX_DB.BUCKET,
        ENV_CONFIG.INFLUX_DB.ORGANIZTION,
        ENV_CONFIG.INFLUX_DB.URL,
        ENV_CONFIG.INFLUX_DB.TOKEN,
      );
      if (this.influxDbClient) {
        this.influxDbClient.initWriteApi();
      }
    } catch (err) {
      this.logger.log(
        `call connectInfluxdb method has error: ${err.message}`,
        err.stack,
      );
    }
  }

  @OnQueueError()
  async onError(error: Error) {
    this.logger.error(`Queue Error: ${error.stack}`);
  }

  @OnQueueFailed()
  async onFailed(job: Job, error: Error) {
    this.logger.error(`Failed job ${job.id} of type ${job.name}`);
    this.logger.error(`Error: ${error}`);
  }
}
