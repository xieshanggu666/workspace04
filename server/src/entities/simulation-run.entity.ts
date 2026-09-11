import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * 一次仿真的完整结果，按小时存储为 JSON，
 * 供时间轴拖动回放与方案对比直接读取，不必重复计算。
 */
@Entity('simulation_runs')
export class SimulationRun {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 64 })
  scenarioName: string;

  @Column({ length: 16, default: 'plan' })
  mode: string;

  @Column({ length: 10 })
  date: string;

  /** SimulationResult（见 simulation/types.ts） */
  @Column({ type: 'simple-json' })
  result: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
