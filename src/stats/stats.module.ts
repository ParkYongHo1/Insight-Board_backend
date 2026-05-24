import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { StatsGateway } from './stats.gateway';
import { StatsService } from './stats.service';
import { StockProvider } from './providers/stock.provider';
import { FinnhubWsService } from './providers/finnhub-ws.service';
import { SlackAlertService } from './providers/slack-alert.service';
import { DashboardModel } from 'src/dashboard/entities/dashboard.entity';
import { UserModel } from 'src/user/entities/user.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([DashboardModel, UserModel]),
  ],
  providers: [
    StatsGateway,
    StatsService,
    StockProvider,
    FinnhubWsService,
    SlackAlertService,
  ],
})
export class StatsModule {}
