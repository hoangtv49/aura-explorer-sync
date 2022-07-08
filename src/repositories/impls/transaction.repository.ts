import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ENTITIES_CONFIG } from '../../module.config';
import { ObjectLiteral, Repository } from 'typeorm';
import { ITransactionRepository } from '../itransaction.repository';
import { BaseRepository } from './base.repository';

@Injectable()
export class TransactionRepository
  extends BaseRepository
  implements ITransactionRepository
{
  private readonly _logger = new Logger(TransactionRepository.name);
  constructor(
    @InjectRepository(ENTITIES_CONFIG.TRANSACTION)
    private readonly repos: Repository<ObjectLiteral>,
  ) {
    super(repos);
    this._logger.log(
      '============== Constructor Transaction Repository ==============',
    );
  }
}
