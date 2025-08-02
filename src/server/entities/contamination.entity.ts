import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('contamination_data')
export class ContaminationData {
  @PrimaryGeneratedColumn()
  id: string;

  @Column()
  serverCode: string;

  @Column()
  status: string;

  @Column()
  bucket: string;

  @Column()
  date: string;

  @Column({ type: 'json' })
  images: Array<{ path: string; url: string | null }>;

  @Column({ type: 'json', nullable: true })
  detail: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 