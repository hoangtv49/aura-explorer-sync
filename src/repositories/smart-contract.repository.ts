import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Equal, Not, Repository } from 'typeorm';
import {
  CONTRACT_CODE_RESULT,
  CONTRACT_TYPE,
  SMART_CONTRACT_VERIFICATION,
} from '../common/constants/app.constant';
import { SmartContract } from '../entities';
import { BaseRepository } from './base.repository';

@Injectable()
export class SmartContractRepository extends BaseRepository<SmartContract> {
  private readonly _logger = new Logger(SmartContractRepository.name);
  constructor(
    @InjectRepository(SmartContract)
    private readonly repos: Repository<SmartContract>,
  ) {
    super(repos);
    this._logger.log(
      '============== Constructor Smart Contract Repository ==============',
    );
  }

  async getLatestBlockHeight() {
    const query = this.repos
      .createQueryBuilder('smart_contracts')
      .select('smart_contracts.height as height')
      .orderBy('smart_contracts.id', 'DESC');
    const res = await query.getRawOne();
    if (res) {
      return res.height;
    }
    return 0;
  }

  async findExactContractByHash(contract_hash: string) {
    const query = this.repos
      .createQueryBuilder('smart_contracts')
      .where('smart_contracts.contract_hash = :contract_hash', {
        contract_hash,
      })
      .andWhere(
        'smart_contracts.contract_verification = :contract_verification',
        {
          contract_verification: SMART_CONTRACT_VERIFICATION.VERIFIED,
        },
      )
      .select([
        'smart_contracts.contract_address as contract_address',
        'smart_contracts.url as url',
        'smart_contracts.contract_verification as contract_verification',
        'smart_contracts.compiler_version as compiler_version',
        'smart_contracts.instantiate_msg_schema as instantiate_msg_schema',
        'smart_contracts.query_msg_schema as query_msg_schema',
        'smart_contracts.execute_msg_schema as execute_msg_schema',
        'smart_contracts.s3_location as s3_location',
        'smart_contracts.reference_code_id as reference_code_id',
        'smart_contracts.mainnet_upload_status as mainnet_upload_status',
      ]);
    const res = await query.getRawOne();
    return res;
  }

  async getContractCodeByStatus(status: CONTRACT_CODE_RESULT) {
    const sqlSelect = `sc.contract_address, scc.result, scc.type`;

    const queryBuilder = this.repos
      .createQueryBuilder('sc')
      .select(sqlSelect)
      .innerJoin(
        'smart_contract_codes',
        'scc',
        `sc.code_id = scc.code_id AND scc.result = '${status}'`,
      )
      .where({ token_symbol: Equal('') });

    return await queryBuilder.getRawMany();
  }

  async getCW20Info() {
    const sqlSelect = `sc.contract_address, sc.token_name, sc.token_symbol, sc.description, sc.image, sc.code_id`;

    const queryBuilder = this.repos
      .createQueryBuilder('sc')
      .select(sqlSelect)
      .innerJoin(
        'smart_contract_codes',
        'scc',
        `sc.code_id = scc.code_id AND scc.result = '${CONTRACT_CODE_RESULT.CORRECT}' AND scc.type = '${CONTRACT_TYPE.CW20}'`,
      )
      .where({ token_symbol: Not('') });

    return await queryBuilder.getRawMany();
  }

  /**
   * Update num_tokens column when transactions have type mint/burn
   * @param contractAddress
   * @param numtokens
   * @returns
   */
  async updateNumtokens(contractAddress: string, numtokens: number) {
    return await this.repos.query(
      `UPDATE smart_contracts SET num_tokens=? WHERE contract_address=?`,
      [numtokens, contractAddress],
    );
  }

  /**
   * Get contract correct by address
   * @param contractAddress
   */
  async getSmartContractCorrect(contractAddress: string, type: string) {
    return await this.repos
      .createQueryBuilder('sm')
      .select(
        `sm.contract_address, sm.token_name, sm.token_symbol, sm.image, sm.description, sm.code_id, scc.result, scc.\`type\``,
      )
      .innerJoin(
        'smart_contract_codes',
        'scc',
        `sm.code_id = scc.code_id AND scc.result = '${CONTRACT_CODE_RESULT.CORRECT}' AND scc.type = '${type}'`,
      )
      .where('sm.contract_address=:contractAddress', { contractAddress })
      .getRawOne();
  }

  /**
   * Get contractr info
   * @param contractAddress
   * @param type
   * @returns
   */
  async getContractInfo(contractAddress: string) {
    return await this.repos
      .createQueryBuilder('sm')
      .select(`sm.*, scc.result, scc.\`type\``)
      .innerJoin('smart_contract_codes', 'scc', `sm.code_id = scc.code_id`)
      .where('sm.contract_address=:contractAddress', { contractAddress })
      .getRawOne();
  }
}
