import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsOrder, IsNull } from 'typeorm';
import { InvestigationCaseMapper } from '@modules/investigations/infrastructure/mappers/investigation-case.mapper';
import { InvestigationCaseOrmEntity } from '@modules/investigations/infrastructure/orm-entities/investigation-case.orm-entity';
import { InvestigationCaseEntity } from '@modules/investigations/application/domain/entities/investigation-case.entity';
const fields = ['id', 'title', 'kind', 'status', 'severity', 'createdAt', 'updatedAt'] as const;
export type InvestigationCaseOrderField = (typeof fields)[number];
export interface InvestigationCasePaginationOptions { skip: number; take: number; orderBy: InvestigationCaseOrderField; orderDirection: 'ASC' | 'DESC'; tenantId?: string }
function scope(tenantId?: string): string { if (!tenantId) throw new ForbiddenException('Verified tenant scope required'); return tenantId; }
@Injectable()
export class InvestigationCaseRepository {
  constructor(@InjectRepository(InvestigationCaseOrmEntity) private readonly repository: Repository<InvestigationCaseOrmEntity>, private readonly mapper: InvestigationCaseMapper) {}
  static isOrderByField(value: string): value is InvestigationCaseOrderField { return fields.some((field) => field === value); }
  async create(entity: InvestigationCaseEntity): Promise<InvestigationCaseEntity> {
    const orm = this.mapper.toOrmEntity(entity); scope(orm.tenant_id);
    return this.mapper.toDomainEntity(await this.repository.save(orm));
  }
  async findById(id: string, tenantId?: string): Promise<InvestigationCaseEntity | null> {
    const orm = await this.repository.findOne({ where: { id, tenant_id: scope(tenantId), deletedAt: IsNull() } });
    return orm ? this.mapper.toDomainEntity(orm) : null;
  }
  async findAll(tenantId?: string): Promise<InvestigationCaseEntity[]> {
    const rows = await this.repository.find({ where: { tenant_id: scope(tenantId), deletedAt: IsNull() } });
    return rows.map((row) => this.mapper.toDomainEntity(row));
  }
  async findAllPaginated(options: InvestigationCasePaginationOptions): Promise<[InvestigationCaseEntity[], number]> {
    const order: FindOptionsOrder<InvestigationCaseOrmEntity> = { [options.orderBy]: options.orderDirection };
    const [rows, total] = await this.repository.findAndCount({ where: { tenant_id: scope(options.tenantId), deletedAt: IsNull() }, skip: options.skip, take: options.take, order });
    return [rows.map((row) => this.mapper.toDomainEntity(row)), total];
  }
  async update(id: string, entity: InvestigationCaseEntity, tenantId?: string): Promise<InvestigationCaseEntity> {
    const tenant = scope(tenantId); const orm = this.mapper.toOrmEntity(entity);
    if (orm.tenant_id !== tenant) throw new ForbiddenException('Tenant reassignment is forbidden');
    const result = await this.repository.update({ id, tenant_id: tenant, deletedAt: IsNull() }, orm);
    if (!result.affected) throw new NotFoundException('Case not found');
    return entity;
  }
  async exists(id: string, tenantId?: string): Promise<boolean> { return (await this.repository.count({ where: { id, tenant_id: scope(tenantId), deletedAt: IsNull() } })) > 0; }
}
