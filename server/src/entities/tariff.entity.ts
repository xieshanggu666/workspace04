import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export type TariffPeriod = 'valley' | 'flat' | 'peak';

@Entity('tariffs')
export class Tariff {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64, default: '校园分时电价' })
  name: string;

  /** 逐时时段 valley/flat/peak（长度 24） */
  @Column({ type: 'simple-json' })
  periods: TariffPeriod[];

  /** 谷 / 平 / 峰 购电价格 元/kWh */
  @Column('double', { default: 0.35 })
  valleyPrice: number;

  @Column('double', { default: 0.75 })
  flatPrice: number;

  @Column('double', { default: 1.25 })
  peakPrice: number;

  /** 余电上网价格 元/kWh */
  @Column('double', { default: 0.38 })
  sellPrice: number;

  /** 基本（变压器容量）电费 元/kW·月，按当月最大需量计 */
  @Column('double', { default: 40 })
  demandCharge: number;
}
