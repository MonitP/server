import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ProcessStatus } from '../server.interface';

@Entity('servers')
export class Servers {
  @PrimaryGeneratedColumn()
  id: string;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column()
  ip: string;

  @Column()
  port: number;

  @Column({ type: 'json', nullable: true })
  processes: ProcessStatus[];

  @Column({ type: 'json', nullable: true })
  cpuHistory: number[];

  @Column({ type: 'json', nullable: true })
  ramHistory: number[];

  @Column({ type: 'json', nullable: true })
  gpuHistory: number[];

  @Column({ type: 'json', nullable: true })
  networkHistory: number[];

  @Column({ type: 'json', nullable: true })
  uptimeHistory: number[];

  @Column({ type: 'int', default: 0 })
  upTime: number;

  @Column({ type: 'int', default: 0 })
  downTime: number;

  @Column({ type: 'timestamp', nullable: true })
  lastRestart: Date;

  @Column({ type: 'timestamp', nullable: true })
  startTime: Date;

  @Column({ type: 'float', default: 0 })
  availability: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  historyDate: string;

  @Column({ type: 'boolean', default: false })
  isNoServer: boolean;
} 