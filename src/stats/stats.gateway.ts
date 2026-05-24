import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { StatsService } from './stats.service';

export interface TableRow {
  groupName: string;
  groupColumn: string;
  [key: string]: string | number;
}

export interface ChartItem {
  id: string;
  label: string;
  value: number;
}

export interface ProcessedData {
  tableData: TableRow[];
  groupData: ChartItem[];
  metricData: ChartItem[];
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'https://insight-board-frontend-phi.vercel.app',
    ],
    credentials: true,
  },
})
@Injectable()
export class StatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(StatsGateway.name);

  constructor(
    @Inject(forwardRef(() => StatsService))
    private readonly statsService: StatsService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`클라이언트 연결: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`클라이언트 연결 해제: ${client.id}`);
  }

  @SubscribeMessage('subscribe')
  onSubscribe(
    @MessageBody() data: { dashboardId: number },
    @ConnectedSocket() client: Socket,
  ) {
    this.handleSubscribe(client, data.dashboardId);
  }

  handleSubscribe(client: Socket, dashboardId: number) {
    const cached = this.statsService.getLatestData(dashboardId);
    if (cached) {
      client.emit(`stats-${dashboardId}`, cached);
    }
    void this.statsService.fetchAndBroadcastOne(dashboardId);
    this.logger.log(
      `[Gateway] 구독 → dashboard ${dashboardId} fresh fetch 트리거`,
    );
  }

  // 추가
  sendData(dashboardId: number, data: ProcessedData) {
    this.server.emit(`stats-${dashboardId}`, data);
  }
}
