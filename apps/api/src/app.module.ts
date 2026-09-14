import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configModuleOptions } from './config/config-module.options';
import { HealthModule } from './shared/health/health.module';
import { StaffAuthGuard } from './shared/auth/staff-auth.guard';
import { SessionsModule } from './shared/sessions/sessions.module';
import { CreditReadController } from './infrastructure/owners/credit-read.controller';
import { IngestionReadController } from './infrastructure/owners/ingestion-read.controller';
import { ConsoleCapabilitiesController } from './infrastructure/owners/console-capabilities';
import { PartnerWorkspaceController } from './infrastructure/owners/partner-workspace.controller';
import { CaseWorkflowModule } from './modules/investigations/case-workflow.module';
import { consoleMigrations } from './migrations';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres', url: config.get<string>('database.url') ?? 'postgresql://postgres:postgres@localhost:5435/mobicred_console',
        ssl: config.get<boolean>('database.ssl') ?? false, logging: config.get<boolean>('database.logging') ?? false,
        autoLoadEntities: true, synchronize: false, migrations: consoleMigrations,
        migrationsRun: process.env.CONSOLE_RUN_MIGRATIONS === 'true',
      }),
    }),
    SessionsModule, HealthModule, CaseWorkflowModule,
  ],
  controllers: [CreditReadController, IngestionReadController, ConsoleCapabilitiesController, PartnerWorkspaceController],
  providers: [{ provide: APP_GUARD, useClass: StaffAuthGuard }],
})
export class AppModule {}
