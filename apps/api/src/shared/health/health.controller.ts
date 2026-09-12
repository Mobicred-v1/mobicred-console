import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private database: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Basic health check' })
  check() { return this.health.check([() => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024)]); }

  @Get('ready')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Database-backed readiness check; no staff authentication required' })
  readiness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.database.pingCheck('database', { timeout: 2000 }),
    ]);
  }

  @Get('live')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness check independent of database readiness' })
  liveness() { return this.health.check([() => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024)]); }
}
