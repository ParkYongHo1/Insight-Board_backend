import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interval } from '@nestjs/schedule';

import { DashboardModel } from 'src/dashboard/entities/dashboard.entity';
import {
  StatsGateway,
  ProcessedData,
  TableRow,
  ChartItem,
} from './stats.gateway';
import { StockProvider, StockStats } from './providers/stock.provider';
import { SlackAlertService } from './providers/slack-alert.service';

type RawDataItem = Omit<StockStats, 'scoreBreakdown'>;

interface DashboardGroup {
  key: string;
  value: string;
  alias: string;
}

interface DashboardMetric {
  column: string;
  alias: string;
}

@Injectable()
export class StatsService implements OnModuleInit {
  private readonly logger = new Logger(StatsService.name);
  private readonly latestCache = new Map<number, ProcessedData>();

  constructor(
    @Inject(forwardRef(() => StatsGateway))
    private readonly gateway: StatsGateway,
    private readonly stockProvider: StockProvider,
    private readonly slackAlert: SlackAlertService,
    @InjectRepository(DashboardModel)
    private readonly dashboardRepository: Repository<DashboardModel>,
  ) {}

  async onModuleInit() {
    this.logger.log('[Stats] 퀀트 데이터 엔진 시동');
    await this.fetchAndBroadcast();
  }

  getLatestData(dashboardId: number): ProcessedData | null {
    return this.latestCache.get(dashboardId) ?? null;
  }

  private toRawData(data: StockStats[]): RawDataItem[] {
    return data.map((item) => {
      const raw: RawDataItem = {
        ticker: item.ticker,
        companyName: item.companyName,
        price: item.price,
        changePercent: item.changePercent,
        ma20: item.ma20,
        ma50: item.ma50,
        ma200: item.ma200,
        above20MA: item.above20MA,
        above50MA: item.above50MA,
        above200MA: item.above200MA,
        rsi: item.rsi,
        analystBuy: item.analystBuy,
        analystHold: item.analystHold,
        analystSell: item.analystSell,
        analystScore: item.analystScore,
        analystTotal: item.analystTotal,
        momentum: item.momentum,
        momentumSignal: item.momentumSignal,
        purchaseScore: item.purchaseScore,
        purchaseZone: item.purchaseZone,
      };
      return raw;
    });
  }

  async fetchAndBroadcastOne(dashboardId: number): Promise<void> {
    try {
      const dashboard = await this.dashboardRepository.findOne({
        where: { id: dashboardId },
      });
      if (!dashboard) return;

      const groups = (dashboard.groups as unknown as DashboardGroup[]) || [];
      const metrics = (dashboard.metrics as unknown as DashboardMetric[]) || [];
      if (!groups.length || !metrics.length) return;

      const targetTickers = [
        ...new Set(groups.map((g) => g.value).filter(Boolean)),
      ];
      if (!targetTickers.length) return;

      const data: StockStats[] = await this.stockProvider.fetch(targetTickers);
      const rawData = this.toRawData(data);

      const processedData = this.processByConfig(rawData, groups, metrics);
      this.latestCache.set(dashboardId, processedData);
      this.gateway.sendData(dashboardId, processedData);

      this.logger.log(`[Stats] 대시보드 ${dashboardId} 즉시 fetch & emit 완료`);
    } catch (err) {
      this.logger.error(
        `[Stats] 단일 대시보드 fetch 실패 (${dashboardId}):`,
        err,
      );
    }
  }

  @Interval(60000)
  async fetchAndBroadcast(): Promise<void> {
    try {
      const dashboards = await this.dashboardRepository.find();

      const allTickers = [
        ...new Set(
          dashboards.flatMap((d) => {
            const groups = (d.groups as unknown as DashboardGroup[]) || [];
            return groups.map((g) => g.value).filter(Boolean);
          }),
        ),
      ];

      if (!allTickers.length) return;

      const data: StockStats[] = await this.stockProvider.fetch(allTickers);
      const rawData = this.toRawData(data);

      Promise.all(
        data.map((item) =>
          this.slackAlert
            .checkAndAlert({
              ticker: item.ticker,
              companyName: item.companyName,
              purchaseScore: item.purchaseScore,
              purchaseZone: item.purchaseZone,
              price: item.price,
              changePercent: item.changePercent,
              rsi: item.rsi,
              above50MA: item.above50MA,
              above200MA: item.above200MA,
              analystScore: item.analystScore,
              analystTotal: item.analystTotal,
              momentum: item.momentum,
              momentumSignal: item.momentumSignal,
            })
            .catch((err) =>
              this.logger.error(
                `[Stats] 슬랙 알림 실패 (${item.ticker}):`,
                err,
              ),
            ),
        ),
      ).catch((err) =>
        this.logger.error('[Stats] 슬랙 알림 프로세스 예외:', err),
      );

      for (const dashboard of dashboards) {
        const groups = (dashboard.groups as unknown as DashboardGroup[]) || [];
        const metrics =
          (dashboard.metrics as unknown as DashboardMetric[]) || [];
        if (!groups.length || !metrics.length) continue;

        const processedData = this.processByConfig(rawData, groups, metrics);
        this.latestCache.set(Number(dashboard.id), processedData);
        this.gateway.sendData(Number(dashboard.id), processedData);
        this.logger.log(`[Stats] 대시보드 ${dashboard.id} emit 및 캐싱 완료`);
      }
    } catch (err) {
      this.logger.error('[Stats] 브로드캐스트 실패:', err);
    }
  }

  private processByConfig(
    rawData: RawDataItem[],
    groups: DashboardGroup[],
    metrics: DashboardMetric[],
  ): ProcessedData {
    const tableData: TableRow[] = groups.map((group) => {
      const matched = rawData.find(
        (item) =>
          String(item.ticker ?? '')
            .trim()
            .toLowerCase() ===
          String(group.value ?? '')
            .trim()
            .toLowerCase(),
      );

      const row: TableRow = {
        groupName: group.alias,
        groupColumn: group.key || 'ticker',
      };

      metrics.forEach((metric) => {
        const val = matched?.[metric.column as keyof RawDataItem];
        row[metric.alias] = val !== undefined && val !== null ? val : '-';
      });

      return row;
    });

    const groupData: ChartItem[] = rawData
      .map((item) => {
        const ticker = String(item.ticker ?? '');
        const matched = groups.find(
          (g) => g.value.toLowerCase() === ticker.toLowerCase(),
        );
        if (!matched) return null;
        return {
          id: ticker,
          label: matched.alias,
          value: Number(item.price ?? 0),
        };
      })
      .filter((item): item is ChartItem => item !== null);

    const firstMetric = metrics[0];
    const metricData: ChartItem[] = firstMetric
      ? tableData.map((row) => ({
          id: row.groupName,
          label: row.groupName,
          value: Number(row[firstMetric.alias] ?? 0),
        }))
      : [];

    return { tableData, groupData, metricData };
  }
}
