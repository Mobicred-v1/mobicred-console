import { Global, Module } from '@nestjs/common';
import { ConsoleSessions } from './console-sessions.service';
import { ConsoleSessionController } from './console-session.controller';

@Global()
@Module({ providers: [ConsoleSessions], controllers: [ConsoleSessionController], exports: [ConsoleSessions] })
export class SessionsModule {}
