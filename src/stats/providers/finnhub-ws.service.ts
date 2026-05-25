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
  private reconnectDelay = 10000; // 초기 10초
  private readonly maxReconnectDelay = 60000; // 최대 60초

  constructor(private readonly redisService: RedisService) {}

  onModuleInit() {
    this.redis = this.redisService.getClient();
    // 서버 시작 시 3초 후 연결 (다른 모듈 초기화 완료 대기)
    setTimeout(() => this.connect(), 3000);
  }

  onModuleDestroy() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }

  private connect() {
    this.ws = new WebSocket(`wss://ws.finnhub.io?token=${this.apiKey}`);

    this.ws.on('open', () => {
      this.logger.log('[FinnhubWS] 연결됨');
      this.reconnectDelay = 10000; // 연결 성공 시 딜레이 초기화

      // 티커마다 300ms 간격으로 구독 (Rate Limit 방지)
      let delay = 0;
      this.subscribedTickers.forEach((ticker) => {
        setTimeout(() => this.sendSubscribe(ticker), delay);
        delay += 300;
      });
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

    this.ws.on('close', (code) => {
      this.logger.warn(
        `[FinnhubWS] 연결 끊김 (code: ${code}) - ${this.reconnectDelay / 1000}초 후 재연결`,
      );
      this.reconnectTimer = setTimeout(() => {
        this.connect();
        // 지수 백오프: 실패할수록 딜레이 증가
        this.reconnectDelay = Math.min(
          this.reconnectDelay * 2,
          this.maxReconnectDelay,
        );
      }, this.reconnectDelay);
    });
  }

  private sendSubscribe(ticker: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'subscribe', symbol: ticker }));
      this.logger.log(`[FinnhubWS] 구독: ${ticker}`);
    }
  }

  subscribe(ticker: string) {
    this.subscribedTickers.add(ticker);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(ticker);
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
