import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('servers')
export class Servers {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  ip: string;

  @Column()
  port: number;

  @Column({ type: 'json', nullable: true })
  processes: Array<{
    id: string;
    name: string;
    status: 'running' | 'stopped';
  }>;

  @Column({ type: 'json', nullable: true })
  cpuHistory: number[];

  @Column({ type: 'json', nullable: true })
  memoryHistory: number[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 