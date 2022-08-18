import {
  InfluxDB,
  Point,
  QueryApi,
  WriteApi
} from '@influxdata/influxdb-client';
import { TokenCW20Dto } from '../dtos/token-cw20.dto';

export class InfluxDBClient {
  private client: InfluxDB;
  private queryApi: QueryApi;
  private writeApi: WriteApi;

  constructor(
    public bucket: string,
    public org: string,
    public url: string,
    public token: string,
  ) {
    this.client = new InfluxDB({ url, token });
  }

  initQueryApi(): void {
    this.queryApi = this.client.getQueryApi(this.org);
  }

  initWriteApi(): void {
    this.writeApi = this.client.getWriteApi(this.org, this.bucket);
    return;
  }

  closeWriteApi(): void {
    this.writeApi.close().then(() => {
      return;
    });
  }

  /**
   * queryData
   * @param measurement
   * @param statTime
   * @param step
   * @returns
   */
  queryData(measurement, statTime, step) {
    const results: {
      count: string;
      timestamp: string;
    }[] = [];
    const query = `from(bucket: "${this.bucket}") |> range(start: ${statTime}) |> filter(fn: (r) => r._measurement == "${measurement}") |> window(every: ${step}) |> count()`;
    const output = new Promise((resolve) => {
      this.queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          results.push({
            timestamp: o._start,
            count: String(o._value),
          });
        },
        error(error) {
          console.error(error);
          console.log('Finished ERROR');
          return resolve(results);
        },
        complete() {
          console.log('Finished SUCCESS');
          return resolve(results);
        },
      });
    });
    return output;
  }

  /**
   * writeBlock
   * @param height
   * @param block_hash
   * @param num_txs
   * @param chainid
   * @param timestamp
   * @param proposer
   */
  writeBlock(height, block_hash, num_txs, chainid, timestamp, proposer): void {
    const point = new Point('blocks_measurement')
      .tag('chainid', chainid)
      .stringField('block_hash', block_hash)
      .intField('height', height)
      .intField('num_txs', num_txs)
      .timestamp(this.convertDate(timestamp))
      .stringField('proposer', proposer);
    this.writeApi.writePoint(point);
  }

  /**
   * writeTx
   * @param tx_hash
   * @param height
   * @param type
   * @param timestamp
   */
  writeTx(tx_hash, height, type, timestamp): void {
    const point = new Point('txs')
      // .tag('chainid', chainid)
      .stringField('tx_hash', tx_hash)
      .intField('height', height)
      .stringField('type', type)
      .timestamp(this.convertDate(timestamp));
    this.writeApi.writePoint(point);
  }

  /**
   * writeTxs
   * @param values
   */
  writeTxs(values: Array<any>): void {
    const points: Array<Point> = [];
    values.forEach((item) => {
      const point = new Point('txs')
        // .tag('chainid', chainid)
        .stringField('tx_hash', item.tx_hash)
        .intField('height', item.height)
        .stringField('type', item.type)
        .timestamp(this.convertDate(item.timestamp));
      points.push(point);
    });

    if (points.length > 0) {
      this.writeApi.writePoints(points);
    }
  }

  /**
   * convertDate
   * @param timestamp
   * @returns
   */
  convertDate(timestamp: any): Date {
    const strTime = String(timestamp);
    const idx = strTime.lastIndexOf('.');
    let dateConvert = (idx > (-1)) ? strTime.substring(0, idx) + '.000Z' : strTime;
    return new Date(dateConvert);
  }

  /**
   * writeValidator
   * @param operator_address
   * @param title
   * @param jailed
   * @param power
   */
  writeValidator(operator_address, title, jailed, power): void {
    const point = new Point('validators')
      .stringField('operator_address', operator_address)
      .stringField('title', title)
      .stringField('jailed', jailed)
      .intField('power', power);
    this.writeApi.writePoint(point);
  }

  /**
   * writeDelegation
   * @param delegator_address
   * @param validator_address
   * @param shares
   * @param amount
   * @param tx_hash
   * @param created_at
   * @param type
   */
  writeDelegation(
    delegator_address,
    validator_address,
    shares,
    amount,
    tx_hash,
    created_at,
    type,
  ): void {
    const point = new Point('delegation')
      .stringField('delegator_address', delegator_address)
      .stringField('validator_address', validator_address)
      .stringField('shares', shares)
      .stringField('amount', amount)
      .stringField('tx_hash', tx_hash)
      .stringField('created_at', created_at)
      .stringField('type', type);
    this.writeApi.writePoint(point);
  }

  /**
   * writeDelegations
   * @param values
   */
  writeDelegations(values: Array<any>): void {
    const points: Array<Point> = [];
    values.forEach((item) => {
      const point = new Point('delegation')
        .stringField('delegator_address', item.delegator_address)
        .stringField('validator_address', item.validator_address)
        .stringField('shares', item.shares)
        .stringField('amount', item.amount)
        .stringField('tx_hash', item.tx_hash)
        .stringField('created_at', item.created_at)
        .stringField('type', item.type);

      points.push(point);
    });

    if (values.length > 0) {
      this.writeApi.writePoints(points);
    }
  }

  /**
   * writeMissedBlock
   * @param validator_address
   * @param height
   */
  writeMissedBlock(validator_address, height): void {
    const point = new Point('delegation')
      .stringField('validator_address', validator_address)
      .stringField('height', height);
    this.writeApi.writePoint(point);
  }


  /**
   * Flush data to insert record influxdb
   */
  async flushData() {
    await this.writeApi.flush();
  }

  /**
   * Get max data by column
   * @param measurement 
   * @param start 
   * @param coloumn 
   * @returns 
   */
  getMax(measurement: string, start: string, coloumn: string): Promise<any> {
    const query = `from(bucket: "${this.bucket}") |> range(start: ${start}) |> filter(fn: (r) => r._measurement == "${measurement}")|> filter(fn: (r) => r._field == "${coloumn}")|> max() `;

    const results: { max: number } = { max: 0 };

    const output = new Promise((resolve) => {
      this.queryApi.queryRows(query, {
        next(row, tableMeta) {
          const o = tableMeta.toObject(row);
          results.max = Number(o._value);
        },
        error(error) {
          console.error(error);
          console.log('Finished ERROR');
          return resolve(results);
        },
        complete() {
          console.log('Finished SUCCESS');
          return resolve(results);
        },
      });
    });
    return output;
  }

  /**
   * Write blocks to Influxd
   * @param values 
   */
  async writeBlocks(values: Array<any>): Promise<void> {
    const points: Array<Point> = [];
    values.forEach((item) => {
      const point = new Point('blocks_measurement')
        .tag('chainid', item.chainid)
        .stringField('block_hash', item.block_hash)
        .intField('height', item.height)
        .intField('num_txs', item.num_txs)
        .timestamp(this.convertDate(item.timestamp))
        .stringField('proposer', item.proposer);
      points.push(point);
    });

    if (points.length > 0) {
      this.writeApi.writePoints(points);
      await this.writeApi.flush();
    }
  }


  async writeBlockTokenPriceAndVolume(tokens: TokenCW20Dto[]) {
    const points: Array<Point> = [];
    tokens.forEach(token => {
      const point = new Point('token_cw20_measurement')
        .stringField('coinId', token.coinId)
        .stringField('current_price', token.current_price)
        .stringField('last_updated', token.last_updated)
        .stringField('market_cap_rank', token.market_cap_rank)
        .stringField('price_change_24h', token.price_change_24h)
        .stringField('price_change_percentage_24h', token.price_change_percentage_24h)
        .stringField('total_volume', token.total_volume)
        .stringField('usd_24h_change', token.usd_24h_change)
        .timestamp(this.convertDate(token.timestamp));
      points.push(point);
    });

    if (points.length > 0) {
      this.writeApi.writePoints(points);
      await this.writeApi.flush();
    }
  }


  writeHolder() {

  }
}
