import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type AlarmSeverity = 'info' | 'warning' | 'critical';
export type AlarmStatus = 'active' | 'acknowledged' | 'resolved';

@Entity('alarms')
@Index(['hour'])
export class Alarm {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 16 })
  severity: AlarmSeverity;

  @Column({ length: 64 })
  category: string;

  @Column({ length: 64 })
  deviceName: string;

  @Column({ length: 255 })
  message: string;

  /** 发生时刻：当日第几个小时 0-23 */
  @Column()
  hour: number;

  /** 关联方案（baseline 回放实际运行） */
  @Column({ default: 'baseline' })
  scenario: string;

  /** 天气日期（不同推演日各自一套告警） */
  @Column({ length: 10, default: '' })
  date: string;

  @Column({ length: 16, default: 'active' })
  status: AlarmStatus;

  @CreateDateColumn()
  createdAt: Date;
}
