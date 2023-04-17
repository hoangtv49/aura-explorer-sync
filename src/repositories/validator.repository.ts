import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Validator } from '../entities';
import { BaseRepository } from './base.repository';

@Injectable()
export class ValidatorRepository extends BaseRepository<Validator> {
  private readonly _logger = new Logger(ValidatorRepository.name);
  constructor(
    @InjectRepository(Validator)
    private readonly repos: Repository<Validator>,
  ) {
    super(repos);
    this._logger.log(
      '============== Constructor Validator Repository ==============',
    );
  }

  async getImageValidator() {
    return await this.repos
      .createQueryBuilder('val')
      .select(['operator_address', 'identity', 'image_url'])
      .getRawMany();
  }

  async removeUndelegateValidator(lstOperatorAddress) {
    return await this.repos
      .createQueryBuilder()
      .delete()
      .where({ operator_address: In(lstOperatorAddress) })
      .execute();
  }
}
