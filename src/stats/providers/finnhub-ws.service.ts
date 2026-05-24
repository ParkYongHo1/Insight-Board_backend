import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { WebSocket } from 'ws';
import { RedisService } from '@songkeys/nestjs-redis';
import { Redis } from 'ioredis';

interface FinnhubTrade {
  p: number;
  s: string;
  t: number;
  v: number;
}

interface FinnhubWsMessage {
  type: string;
  data: FinnhubTrade[];
}

@Injectable()
export class FinnhubWsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FinnhubWsService.name);
  private readonly apiKey = process.env.FINNHUB_API_KEY;
  private ws: WebSocket | null = null;
  private redis!: Redis;
  private subscribedTickers = new Set<string>();
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(private readonly redisService: RedisService) {}

  onModuleInit() {
    this.redis = this.redisService.getClient();
    this.connect();
  }

  onModuleDestroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  private connect() {
    this.ws = new WebSocket(`wss://ws.finnhub.io?token=${this.apiKey}`);

    this.ws.on('open', () => {
      this.logger.log('[FinnhubWS] 연결됨');
      this.subscribedTickers.forEach((ticker) => this.subscribe(ticker));
    });

    this.ws.on('message', (raw: Buffer) => {
      void (async () => {
        try {
          const msg = JSON.parse(raw.toString()) as FinnhubWsMessage;
          if (msg.type !== 'trade' || !msg.data?.length) return;

          for (const trade of msg.data) {
            await this.redis.set(
              `price:${trade.s}`,
              JSON.stringify({ price: trade.p, updatedAt: Date.now() }),
              'EX',
              60,
            );
          }
        } catch (e) {
          this.logger.error('[FinnhubWS] 메시지 파싱 실패:', e);
        }
      })();
    });

    this.ws.on('error', (err) => {
      this.logger.error('[FinnhubWS] 에러:', err.message);
    });

    this.ws.on('close', () => {
      this.logger.warn('[FinnhubWS] 연결 끊김 - 5초 후 재연결');
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    });
  }

  subscribe(ticker: string) {
    this.subscribedTickers.add(ticker);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', symbol: ticker }));
      this.logger.log(`[FinnhubWS] 구독: ${ticker}`);
    }
  }

  unsubscribe(ticker: string) {
    this.subscribedTickers.delete(ticker);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'unsubscribe', symbol: ticker }));
    }
  }

  async getPrice(ticker: string): Promise<number | null> {
    const raw = await this.redis.get(`price:${ticker}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as { price: number };
    return data.price;
  }
}
