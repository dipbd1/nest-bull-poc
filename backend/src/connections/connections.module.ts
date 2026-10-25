import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { QueueModule } from '../queue/queue.module.js';
import { ConnectionsController } from './connections.controller.js';
import { ConnectionsService } from './connections.service.js';

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
})
export class ConnectionsModule {}
