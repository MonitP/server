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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  historyDate: string; 
} 