import { InvestigationCaseRepository } from './investigation-case.repository';
import { InvestigationCaseMapper } from '../mappers/investigation-case.mapper';
import { InvestigationCaseOrmEntity } from '../orm-entities/investigation-case.orm-entity';
import { Repository } from 'typeorm';
describe('case tenant isolation', () => {
  const db = { findOne: jest.fn().mockResolvedValue(null), findAndCount: jest.fn().mockResolvedValue([[], 0]), update: jest.fn() };
  const mapper = { toDomainEntity: (v: unknown) => v };
  const repo = new InvestigationCaseRepository(db as unknown as Repository<InvestigationCaseOrmEntity>, mapper as unknown as InvestigationCaseMapper);
  beforeEach(() => jest.clearAllMocks());
  it('fails closed without scope', async () => { await expect(repo.findById('case-1')).rejects.toThrow('Verified tenant scope required'); expect(db.findOne).not.toHaveBeenCalled(); });
  it('includes tenant in point lookup', async () => { await repo.findById('case-1', 'tenant-a'); expect(db.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'case-1', tenant_id: 'tenant-a' }) })); });
  it('includes tenant before pagination and counting', async () => { await repo.findAllPaginated({ tenantId: 'tenant-b', skip: 0, take: 10, orderBy: 'createdAt', orderDirection: 'DESC' }); expect(db.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenant_id: 'tenant-b' }) })); });
});
