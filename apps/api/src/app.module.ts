import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configModuleOptions } from './config/config-module.options';
import { HealthModule } from './shared/health/health.module';
import { StaffAuthGuard } from './shared/auth/staff-auth.guard';
import { SessionsModule } from './shared/sessions/sessions.module';
import { OwnersModule } from './infrastructure/owners/owners.module';
import { CreditReadController } from './infrastructure/owners/credit-read.controller';
import { InvestigationsModule } from './modules/investigations/investigations.module';
import { PrepareConsoleDatabase1789159810000 } from './migrations/1789159810000-prepare-console-database';
import { CreateInvestigationCaseTable1789159811303 } from './migrations/1789159811303-create_investigation_cases_table';
import { ConsoleSessions1789165000000 } from './migrations/1789165000000-console-sessions';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('database.url') ?? 'postgresql://postgres:postgres@localhost:5435/mobicred_console',
        ssl: config.get<boolean>('database.ssl') ?? false,
        logging: config.get<boolean>('database.logging') ?? false,
        autoLoadEntities: true,
        synchronize: false,
        migrations: [PrepareConsoleDatabase1789159810000, CreateInvestigationCaseTable1789159811303, ConsoleSessions1789165000000],
        migrationsRun: process.env.CONSOLE_RUN_MIGRATIONS === 'true',
      }),
    }),
    SessionsModule,
    HealthModule,
    OwnersModule,
    InvestigationsModule,
  ],
  controllers: [CreditReadController],
  providers: [{ provide: APP_GUARD, useClass: StaffAuthGuard }],
})
export class AppModule {}
