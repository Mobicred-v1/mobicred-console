import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configModuleOptions } from './config/config-module.options';
import { HealthModule } from './shared/health/health.module';
import { StaffAuthGuard } from './shared/auth/staff-auth.guard';
import { OwnersModule } from './infrastructure/owners/owners.module';
import { InvestigationsModule } from './modules/investigations/investigations.module';

@Module({
  imports: [
    ConfigModule.forRoot(configModuleOptions),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url:
          config.get<string>('database.url') ??
          'postgresql://postgres:postgres@localhost:5435/mobicred_console',
        ssl: config.get<boolean>('database.ssl') ?? false,
        logging: config.get<boolean>('database.logging') ?? false,
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    HealthModule,
    OwnersModule,
    InvestigationsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: StaffAuthGuard,
    },
  ],
})
export class AppModule {}
