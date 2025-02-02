import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Block } from '../entities';
import { BaseRepository } from './base.repository';

@Injectable()
export class BlockRepository extends BaseRepository<Block> {
  private readonly _logger = new Logger(BlockRepository.name);
  constructor(
    @InjectRepository(Block)
    private readonly repos: Repository<Block>,
  ) {
    super(repos);
    this._logger.log(
      '============== Constructor Block Repository ==============',
    );
  }
}
