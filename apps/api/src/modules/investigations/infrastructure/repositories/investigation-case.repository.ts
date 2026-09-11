import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, FindOptionsOrder } from "typeorm";
import { InvestigationCaseMapper } from "@modules/investigations/infrastructure/mappers/investigation-case.mapper";
import { InvestigationCaseOrmEntity } from "@modules/investigations/infrastructure/orm-entities/investigation-case.orm-entity";
import { InvestigationCaseEntity } from "@modules/investigations/application/domain/entities/investigation-case.entity";

const investigationCaseOrderFields = [
  "id",
  "title",
  "kind",
  "status",
  "severity",
  "customer_ref",
  "assigned_staff_id",
  "source_refs",
  "tenant_id",
  "isActive",
  "createdAt",
  "updatedAt",
] as const satisfies readonly (keyof InvestigationCaseOrmEntity)[];

export type InvestigationCaseOrderField = (typeof investigationCaseOrderFields)[number];

export interface InvestigationCasePaginationOptions {
  skip: number;
  take: number;
  orderBy: InvestigationCaseOrderField;
  orderDirection: "ASC" | "DESC";
}

@Injectable()
export class InvestigationCaseRepository {
  constructor(
    @InjectRepository(InvestigationCaseOrmEntity)
    private readonly repository: Repository<InvestigationCaseOrmEntity>,
    private readonly mapper: InvestigationCaseMapper,
  ) {}

  static isOrderByField(value: string): value is InvestigationCaseOrderField {
    return investigationCaseOrderFields.some((field) => field === value);
  }

  async create(entity: InvestigationCaseEntity): Promise<InvestigationCaseEntity> {
    const ormEntity = this.mapper.toOrmEntity(entity);
    const savedOrmEntity = await this.repository.save(ormEntity);
    return this.mapper.toDomainEntity(savedOrmEntity);
  }

  async findById(id: string): Promise<InvestigationCaseEntity | null> {
    const ormEntity = await this.repository.findOne({
      where: { id, deletedAt: null } as any,
    });

    if (!ormEntity) {
      return null;
    }

    return this.mapper.toDomainEntity(ormEntity);
  }

  async findAll(): Promise<InvestigationCaseEntity[]> {
    const ormEntities = await this.repository.find({
      where: { deletedAt: null } as any,
    });

    return ormEntities.map((ormEntity) => this.mapper.toDomainEntity(ormEntity));
  }

  async findAllPaginated(
    options: InvestigationCasePaginationOptions,
  ): Promise<[InvestigationCaseEntity[], number]> {
    const { skip, take, orderBy, orderDirection } = options;

    const order: FindOptionsOrder<InvestigationCaseOrmEntity> = {
      [orderBy]: orderDirection,
    } as FindOptionsOrder<InvestigationCaseOrmEntity>;

    const [ormEntities, total] = await this.repository.findAndCount({
      where: { deletedAt: null } as any,
      skip,
      take,
      order,
    });

    const entities = ormEntities.map((ormEntity) =>
      this.mapper.toDomainEntity(ormEntity),
    );

    return [entities, total];
  }

  async update(id: string, entity: InvestigationCaseEntity): Promise<InvestigationCaseEntity> {
    const ormEntity = this.mapper.toOrmEntity(entity);
    await this.repository.update(id, ormEntity);
    return entity;
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.repository.count({
      where: { id, deletedAt: null } as any,
    });
    return count > 0;
  }
}
