import { Logger } from '@nestjs/common';
import {
  DeleteResult,
  FindManyOptions,
  OrderByCondition,
  Repository,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { UpsertOptions } from 'typeorm/repository/UpsertOptions';
import { PaginatorResponse } from '../dtos/responses/paginator.response';

export class BaseRepository<T> {
  private _repos: Repository<T>;
  private _log = new Logger(BaseRepository.name);

  public constructor(repos: Repository<T>) {
    this._repos = repos;
  }

  /**
   * Find data
   * @param options
   * @returns
   */
  public find(options: any): Promise<T[]> {
    return this._repos.find(options);
  }

  /**
   * findOne
   * @param condition
   * @returns
   */
  public async findOne(id?: any): Promise<T> {
    if (id) {
      return this._repos.findOne(id);
    } else {
      return this._repos.findOne();
    }
  }

  /**
   * findByCondition
   * @param condition
   * @param orderBy
   * @returns
   */
  public async findByCondition(
    condition: any,
    orderBy?: any,
    select?: string[],
    take?: number,
  ): Promise<T[]> {
    const opt = { where: condition };
    if (orderBy) opt['order'] = orderBy;
    if (select) opt['select'] = select;
    if (take) opt['take'] = take;

    return this._repos.find(opt);
  }

  /**
   * findWithRelations
   * @param relations
   * @returns
   */
  public async findWithRelations(relations: any): Promise<any[]> {
    return this._repos.find(relations);
  }

  /**
   * findAll
   * @param orderBy
   * @returns
   */
  public async findAll(orderBy?: any): Promise<T[]> {
    if (orderBy) {
      return this._repos.find({ order: orderBy });
    } else {
      return this._repos.find();
    }
  }

  /**
   * findAndCount
   * @param pageIndex
   * @param pageSize
   * @param condition
   * @param orderBy
   * @returns
   */
  public async findAndCount(
    pageIndex: number,
    pageSize: number,
    condition: any = null,
    orderBy: any = null,
  ): Promise<PaginatorResponse> {
    const opt = {};
    const paginatorResponse = new PaginatorResponse();

    if (condition) {
      opt['where'] = condition;
    }

    opt['take'] = pageSize;
    opt['skip'] = pageSize * pageIndex;

    if (orderBy) {
      opt['order'] = orderBy;
    }

    const [result, totalRecord] = await this._repos.findAndCount(opt);
    paginatorResponse.pageIndex = pageIndex;
    paginatorResponse.pageSize = pageSize;
    paginatorResponse.pageResults = result;
    paginatorResponse.totalRecord = totalRecord;

    return paginatorResponse;
  }

  /**
   * create
   * @param data
   * @returns
   */
  public async create(data: any): Promise<any> {
    return this._repos.save(data);
  }

  /**
   * insert - fail if duplicate entity
   * @param data
   * @returns
   */
  public async insert(data: any): Promise<any> {
    return this._repos.insert(data);
  }

  /**
   * update
   * @param data
   * @returns
   */
  public async update(data: any): Promise<any> {
    return this._repos.save(data);
  }

  /**
   * remove
   * @param id
   * @returns
   */
  public async remove(id: any): Promise<DeleteResult> {
    return this._repos.delete(id);
  }

  /**
   * upsert
   * @param data
   * @param conflictPathsOrOptions
   */
  public async upsert(data: Array<any>, conflictPathsOrOptions: string[]) {
    const results = await this._repos
      .upsert(data, conflictPathsOrOptions)
      .then((t) => t.identifiers);

    return results;
  }

  /**
   * Get max by column of table
   * @param column
   */
  max(column: string): Promise<any> {
    return this._repos
      .createQueryBuilder()
      .select(`max(${column}) as ${column}`)
      .getRawOne();
  }

  /**
   * Query Data
   * @param column
   * @param conditions
   * @param groupBy
   * @param orderBy
   * @returns
   */
  queryData(
    column: string,
    conditions?: any,
    groupBy?: string,
    orderBy?: OrderByCondition,
  ) {
    let query = this._repos.createQueryBuilder().select(`${column}`);

    if (conditions) {
      query = query.where(conditions);
    }

    if (groupBy) {
      query = query.groupBy(groupBy);
    }

    if (orderBy) {
      query = query.orderBy(orderBy);
    }

    return query.getRawMany();
  }

  /**
   * Get data by pagination
   * @param column
   * @param limit
   * @param pageIndex
   * @param conditions
   * @param groupBy
   * @param orderBy
   * @returns
   */
  queryPaging(
    column: string,
    limit: number,
    pageIndex: number,
    conditions?: any,
    groupBy?: string,
    orderBy?: OrderByCondition,
  ) {
    let query = this._repos
      .createQueryBuilder()
      .select(`${column}`)
      .take(limit)
      .skip(pageIndex * limit);

    if (conditions) {
      query = query.where(conditions);
    }

    if (groupBy) {
      query = query.groupBy(groupBy);
    }

    if (orderBy) {
      query = query.orderBy(orderBy);
    }

    return query.getRawMany();
  }

  /**
   * Create when duplicate
   * @param entityOrEntities
   * @param skipPropetties
   * @returns
   */
  async insertOnDuplicate(
    entityOrEntities: QueryDeepPartialEntity<T> | QueryDeepPartialEntity<T>[],
    skipPropetties?: string[],
  ) {
    try {
      let updateColumns = '';
      const columns = [];
      const properties = [];
      const metadata = this._repos.metadata;

      // Get column name
      metadata.columns.forEach((col) => {
        columns.push(col.databaseName);
        properties.push(col.propertyName);
      });

      // Skip column not update value
      let mapSkipColumns = [];
      if (skipPropetties) {
        mapSkipColumns = metadata
          .mapPropertyPathsToColumns(skipPropetties)
          .map((m) => m.databaseName);
      }

      // Update column
      columns.forEach((item) => {
        if (mapSkipColumns.indexOf(item) < 0) {
          updateColumns +=
            updateColumns.length === 0
              ? `\`${item}\`= VALUES(\`${item}\`)`
              : `,\`${item}\`= VALUES(\`${item}\`)`;
        }
      });

      // Add paramter
      let values = '';
      const paras = [];
      this.valueOfEnities(entityOrEntities).valuesSet.forEach((item) => {
        let mark = '';
        properties.forEach((prop) => {
          if (item[prop] !== undefined) {
            mark += mark.length == 0 ? '?' : ',?';
            paras.push(item[prop]);
          } else {
            mark += mark.length == 0 ? 'DEFAULT' : ',DEFAULT';
          }
        });
        values += values.length === 0 ? `(${mark})` : `, (${mark})`;
      });
      const escapeColumns = columns.map((m) => `\`${m}\``);

      // Create and excecute properties
      const sqlQuery = `INSERT INTO ${metadata.tableName}(${escapeColumns}) VALUES ${values} ON DUPLICATE KEY UPDATE ${updateColumns}`;
      await this._repos.query(sqlQuery, [...paras]);
      return true;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Get value of entities
   * @param values
   * @returns
   */
  valueOfEnities(
    values: QueryDeepPartialEntity<T> | QueryDeepPartialEntity<T>[],
  ) {
    const expressionMap = this._repos.manager
      .createQueryBuilder()
      .expressionMap.clone();
    expressionMap.valuesSet = values;
    return expressionMap;
  }
}
