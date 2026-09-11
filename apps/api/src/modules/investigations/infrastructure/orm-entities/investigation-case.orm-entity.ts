import { Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('investigation_cases')
export class InvestigationCaseOrmEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() title: string;
  @Column() kind: 'customer' | 'payment' | 'credit' | 'partner';
  @Column() status: 'open' | 'waiting' | 'resolved';
  @Column() severity: 'low' | 'medium' | 'high';
  @Column({ nullable: true }) customer_ref?: string;
  @Column({ nullable: true }) assigned_staff_id?: string;
  @Column({ type: 'jsonb', nullable: true }) source_refs?: Record<string, unknown>;
  @Column() tenant_id: string;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
  @DeleteDateColumn({ name: 'deleted_at' }) deletedAt?: Date | null;
}
