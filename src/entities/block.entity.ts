import { Column, Entity, OneToMany, Unique } from 'typeorm';

import { BaseEntityIncrementId } from './base/base.entity';
import { Transaction } from './transaction.entity';

@Entity('blocks')
export class Block extends BaseEntityIncrementId {
  @Unique('block_hash', ['block_hash'])
  @Column({ name: 'block_hash' })
  block_hash: string;

  @Column({ 
    default: '',
    name: 'chainid',
  })
  chainid: string;

  @Column({ name: 'height' })
  height: number;

  @Column({ 
    default: '',
    name: 'identity',
  })
  identity: string;

  @Column({ 
    default: '',
    name: 'moniker',
  })
  moniker: string;

  @Column({ 
    default: 0,
    name: 'num_signatures',
  })
  num_signatures: number;

  @Column({ 
    default: 0,
    name: 'num_txs',
  })
  num_txs: number;

  @Column({ 
    default: '',
    name: 'operator_address',
  })
  operator_address: string;

  @Column({ 
    default: '',
    name: 'proposer',
  })
  proposer: string;

  @Column({ name: 'timestamp' })
  timestamp: Date;

  @Column({ 
    default: 0,
    name: 'gas_used',
  })
  gas_used: number;

  @Column({ 
    default: 0,
    name: 'gas_wanted',
  })
  gas_wanted: number;

  @Column({ 
    default: 0,
    name: 'round',
  })
  round: number;

  @OneToMany(() => Transaction, (tx) => tx.block)
  txs: Transaction[];

  @Column({
    name: 'json_data',
    type: 'json',
    nullable: true
  })
  json_data: any;
}
