import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RedisService } from '@songkeys/nestjs-redis';
import { Redis } from 'ioredis';
import { FinnhubWsService } from './finnhub-ws.service';

export interface StockStats {
  ticker: string;
  companyName: string;
  price: number;
  changePercent: number;
  ma20: number;
  ma50: number;
  ma200: number;
  above20MA: number;
  above50MA: number;
  above200MA: number;
  rsi: number;
  analystBuy: number;
  analystHold: number;
  analystSell: number;
  analystScore: number;
  analystTotal: number;
  momentum: number;
  momentumSignal: 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT';
  purchaseScore: number;
  purchaseZone: string;
  scoreBreakdown: {
    technical: number;
    goldenCross: number;
    rsiScore: number;
    analystScore: number;
    momentumScore: number;
  };
}

interface FinnhubQuote {
  c: number;
  dp: number;
  h: number;
  l: number;
}

interface FinnhubRecommendation {
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
}

interface YahooChartResult {
  chart: {
    result: {
      indicators: {
        quote: { close: (number | null)[] }[];
      };
    }[];
    error: unknown;
  };
}

interface PurchaseScoreParams {
  above20MA: number;
  above50MA: number;
  above200MA: number;
  ma50: number;
  ma200: number;
  rsi: number;
  analystBuyRatio: number;
  analystTotal: number;
  momentum: number;
}

interface ScoreBreakdown {
  technical: number;
  goldenCross: number;
  rsiScore: number;
  analystScore: number;
  momentumScore: number;
}

@Injectable()
export class StockProvider implements OnModuleInit {
  private readonly logger = new Logger(StockProvider.name);
  private readonly apiKey = process.env.FINNHUB_API_KEY;
  private redis!: Redis;

  private readonly TTL = {
    CANDLE: 5 * 60,
    ANALYST: 60 * 60,
    QUOTE: 60,
  };

  constructor(
    private readonly redisService: RedisService,
    private readonly finnhubWs: FinnhubWsService,
  ) {
    this.redis = this.redisService.getClient();
  }

  async onModuleInit() {
    try {
      const patterns = ['candle:*', 'quote:*', 'analyst:*'];
      for (const pattern of patterns) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) await this.redis.del(...keys);
      }
      this.logger.log('[StockProvider] 기존 캐시 초기화 완료');
      this.logger.log(
        `[StockProvider] API KEY: ${this.apiKey ? '설정됨' : '없음!'}`,
      );
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`[StockProvider] 캐시 초기화 실패: ${err.message}`);
    }
  }

  async fetch(tickers: string[]): Promise<StockStats[]> {
    if (!tickers?.length) return [];
    const unique = [...new Set(tickers.map((t) => t.toUpperCase()))];
    unique.forEach((t) => this.finnhubWs.subscribe(t));

    const results: StockStats[] = [];
    for (const ticker of unique) {
      const result = await this.fetchOne(ticker);
      results.push(result);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return results;
  }

  private async fetchOne(ticker: string): Promise<StockStats> {
    try {
      const [wsPrice, quote, closes, analyst] = await Promise.all([
        this.finnhubWs.getPrice(ticker),
        this.getCached<FinnhubQuote>(`quote:${ticker}`, this.TTL.QUOTE, () =>
          this.callFinnhub<FinnhubQuote>(`/quote?symbol=${ticker}`),
        ),
        this.getCached<number[]>(`candle:${ticker}`, this.TTL.CANDLE, () =>
          this.fetchCandlesFromYahoo(ticker),
        ),
        this.getCached<FinnhubRecommendation[]>(
          `analyst:${ticker}`,
          this.TTL.ANALYST,
          () =>
            this.callFinnhub<FinnhubRecommendation[]>(
              `/stock/recommendation?symbol=${ticker}`,
            ),
        ),
      ]);

      if (!quote || !quote.c) {
        this.logger.warn(`[${ticker}] quote 없음 - 기본값 반환`);
        return this.getDefault(ticker);
      }

      const price = wsPrice ?? quote.c ?? 0;
      const changePercent = quote.dp ?? 0;

      const ma20Val = this.calcMA(closes, 20);
      const ma50Val = this.calcMA(closes, 50);
      const ma200Val = this.calcMA(closes, 200);
      const rsiVal = this.calcRSI(closes, 14);

      const above20MA = ma20Val > 0 ? ((price - ma20Val) / ma20Val) * 100 : 0;
      const above50MA = ma50Val > 0 ? ((price - ma50Val) / ma50Val) * 100 : 0;
      const above200MA =
        ma200Val > 0 ? ((price - ma200Val) / ma200Val) * 100 : 0;

      const momentum = this.calcMomentumOscillator(closes);
      const momentumSignal =
        momentum <= -20
          ? 'OVERSOLD'
          : momentum >= 20
            ? 'OVERBOUGHT'
            : 'NEUTRAL';

      const latestAnalyst =
        Array.isArray(analyst) && analyst.length > 0 ? analyst[0] : null;
      const analystTotal = latestAnalyst
        ? latestAnalyst.buy +
          latestAnalyst.strongBuy +
          latestAnalyst.hold +
          latestAnalyst.sell +
          latestAnalyst.strongSell
        : 0;
      const analystBuy = latestAnalyst
        ? latestAnalyst.buy + latestAnalyst.strongBuy
        : 0;
      const analystHold = latestAnalyst?.hold ?? 0;
      const analystSell = latestAnalyst
        ? latestAnalyst.sell + latestAnalyst.strongSell
        : 0;
      const analystBuyRatio =
        analystTotal > 0 ? Math.round((analystBuy / analystTotal) * 100) : 0;

      const { score: purchaseScore, breakdown } = this.calcPurchaseScore({
        above20MA,
        above50MA,
        above200MA,
        ma50: ma50Val,
        ma200: ma200Val,
        rsi: rsiVal,
        analystBuyRatio,
        analystTotal,
        momentum,
      });

      this.logger.log(
        `[${ticker}] price=${price} ma50=${ma50Val} ma200=${ma200Val} rsi=${rsiVal} momentum=${momentum.toFixed(1)}`,
      );
      this.logger.log(
        `[${ticker}] score=${purchaseScore} tech=${breakdown.technical} golden=${breakdown.goldenCross} rsi=${breakdown.rsiScore} analyst=${breakdown.analystScore} momentum=${breakdown.momentumScore}`,
      );

      return {
        ticker,
        companyName: ticker,
        price: Math.round(price * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        ma20: Math.round(ma20Val * 100) / 100,
        ma50: Math.round(ma50Val * 100) / 100,
        ma200: Math.round(ma200Val * 100) / 100,
        above20MA: Math.round(above20MA * 100) / 100,
        above50MA: Math.round(above50MA * 100) / 100,
        above200MA: Math.round(above200MA * 100) / 100,
        rsi: Math.round(rsiVal * 100) / 100,
        analystBuy,
        analystHold,
        analystSell,
        analystScore: analystBuyRatio,
        analystTotal,
        momentum: Math.round(momentum * 100) / 100,
        momentumSignal,
        purchaseScore,
        purchaseZone: this.calcPurchaseZone(purchaseScore),
        scoreBreakdown: breakdown,
      };
    } catch (e) {
      const err = e as Error;
      this.logger.error(`[${ticker}] fetchOne 실패: ${err.message}`);
      return this.getDefault(ticker);
    }
  }

  private calcMomentumOscillator(closes: number[], period = 21): number {
    if (closes.length < period + 1) return 0;

    const roc = closes.slice(period).map((price, i) => {
      const prev = closes[i];
      return prev > 0 ? ((price - prev) / prev) * 100 : 0;
    });

    const smoothed = this.calcEMA(roc, 9);
    const current = smoothed.at(-1) ?? 0;
    return Math.max(-100, Math.min(100, current));
  }

  private calcEMA(data: number[], period: number): number[] {
    if (data.length === 0) return [];
    const k = 2 / (period + 1);
    const result: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  }

  private async fetchCandlesFromYahoo(ticker: string): Promise<number[]> {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=2y`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        this.logger.warn(`[${ticker}] Yahoo Finance 오류: ${res.status}`);
        return [];
      }

      const json = (await res.json()) as YahooChartResult;
      const closes =
        json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
      const filtered = closes.filter(
        (v): v is number => v !== null && !isNaN(v),
      );

      this.logger.log(`[${ticker}] Yahoo candle: ${filtered.length}개`);
      return filtered;
    } catch (e) {
      const err = e as Error;
      this.logger.warn(`[${ticker}] Yahoo Finance 실패: ${err.message}`);
      return [];
    }
  }

  private calcMA(closes: number[], period: number): number {
    if (!closes.length || closes.length < period) return 0;
    const slice = closes.slice(-period);
    return slice.reduce((sum, v) => sum + v, 0) / period;
  }

  private calcRSI(closes: number[], period: number): number {
    if (!closes.length || closes.length < period + 1) return 50;

    const changes = closes.slice(1).map((v, i) => v - closes[i]);
    const gains = changes.map((c) => (c > 0 ? c : 0));
    const losses = changes.map((c) => (c < 0 ? -c : 0));

    let avgGain =
      gains.slice(0, period).reduce((sum, v) => sum + v, 0) / period;
    let avgLoss =
      losses.slice(0, period).reduce((sum, v) => sum + v, 0) / period;

    for (let i = period; i < changes.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return Math.round((100 - 100 / (1 + rs)) * 100) / 100;
  }

  private calcPurchaseScore(params: PurchaseScoreParams): {
    score: number;
    breakdown: ScoreBreakdown;
  } {
    let technical = 0;
    let goldenCross = 0;
    let rsiScore = 0;
    let analystScore = 0;
    let momentumScore = 0;

    // 기술적 분석 (30점)
    if (params.above200MA >= 10) technical += 15;
    else if (params.above200MA >= 0) technical += 8;

    if (params.above50MA >= 5) technical += 10;
    else if (params.above50MA >= 0) technical += 5;

    if (params.above20MA >= 0) technical += 5;

    // 골든/데드크로스 (10점)
    if (params.ma50 > 0 && params.ma200 > 0) {
      if (params.ma50 > params.ma200) goldenCross = 10;
      else goldenCross = -5;
    }

    // RSI (10점)
    if (params.rsi >= 30 && params.rsi < 40) rsiScore = 10;
    else if (params.rsi >= 40 && params.rsi < 50) rsiScore = 8;
    else if (params.rsi >= 50 && params.rsi < 60) rsiScore = 6;
    else if (params.rsi >= 60 && params.rsi < 70) rsiScore = 3;
    else if (params.rsi >= 70) rsiScore = 1;
    else if (params.rsi < 30) rsiScore = 5;

    // 애널리스트 (35점)
    if (params.analystBuyRatio >= 80 && params.analystTotal >= 10)
      analystScore = 35;
    else if (params.analystBuyRatio >= 80) analystScore = 28;
    else if (params.analystBuyRatio >= 70) analystScore = 22;
    else if (params.analystBuyRatio >= 60) analystScore = 14;
    else if (params.analystBuyRatio >= 50) analystScore = 7;

    // 모멘텀 오실레이터 (15점)
    if (params.momentum <= -30) momentumScore = 15;
    else if (params.momentum <= -20) momentumScore = 12;
    else if (params.momentum <= 0) momentumScore = 8;
    else if (params.momentum <= 20) momentumScore = 4;
    else momentumScore = 1;

    const score = Math.max(
      0,
      Math.min(
        100,
        technical + goldenCross + rsiScore + analystScore + momentumScore,
      ),
    );

    return {
      score,
      breakdown: {
        technical,
        goldenCross,
        rsiScore,
        analystScore,
        momentumScore,
      },
    };
  }

  private calcPurchaseZone(score: number): string {
    if (score >= 80) return 'STRONG_BUY';
    if (score >= 60) return 'BUY';
    if (score >= 40) return 'NEUTRAL';
    if (score >= 20) return 'CAUTION';
    return 'WAIT';
  }

  private async getCached<T>(
    key: string,
    ttl: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as T;
        const isEmptyObject =
          parsed !== null &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          Object.keys(parsed).length === 0;
        const isEmptyArray = Array.isArray(parsed) && parsed.length === 0;
        if (!isEmptyObject && !isEmptyArray) return parsed;
        await this.redis.del(key);
      }
    } catch {
      // 무시
    }

    const data = await fetcher();

    try {
      const isEmptyObject =
        data !== null &&
        typeof data === 'object' &&
        !Array.isArray(data) &&
        Object.keys(data).length === 0;
      const isEmptyArray = Array.isArray(data) && data.length === 0;

      if (!isEmptyObject && !isEmptyArray) {
        await this.redis.set(key, JSON.stringify(data), 'EX', ttl);
      }
    } catch {
      // 무시
    }

    return data;
  }

  private async callFinnhub<T>(path: string): Promise<T> {
    const sep = path.includes('?') ? '&' : '?';
    const url = `https://finnhub.io/api/v1${path}${sep}token=${this.apiKey}`;
    const res = await fetch(url);

    if (res.status === 403) {
      this.logger.warn(`[Finnhub] 403 접근 불가: ${path}`);
      return {} as T;
    }
    if (res.status === 429) {
      this.logger.warn(`[Finnhub] 429 Rate Limit: ${path}`);
      return {} as T;
    }
    if (!res.ok) {
      throw new Error(`Finnhub API 오류: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  private getDefault(ticker: string): StockStats {
    return {
      ticker,
      companyName: ticker,
      price: 0,
      changePercent: 0,
      ma20: 0,
      ma50: 0,
      ma200: 0,
      above20MA: 0,
      above50MA: 0,
      above200MA: 0,
      rsi: 0,
      analystBuy: 0,
      analystHold: 0,
      analystSell: 0,
      analystScore: 0,
      analystTotal: 0,
      momentum: 0,
      momentumSignal: 'NEUTRAL',
      purchaseScore: 0,
      purchaseZone: 'WAIT',
      scoreBreakdown: {
        technical: 0,
        goldenCross: 0,
        rsiScore: 0,
        analystScore: 0,
        momentumScore: 0,
      },
    };
  }
}
