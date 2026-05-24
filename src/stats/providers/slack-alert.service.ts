import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '@songkeys/nestjs-redis';
import { Redis } from 'ioredis';
import { UserModel } from 'src/user/entities/user.entity';

interface SlackAlertParams {
  ticker: string;
  companyName: string;
  purchaseScore: number;
  purchaseZone: string;
  price: number;
  changePercent: number;
  rsi: number;
  above50MA: number;
  above200MA: number;
  analystScore: number;
  analystTotal: number;
  momentum: number;
  momentumSignal: 'OVERSOLD' | 'NEUTRAL' | 'OVERBOUGHT';
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: { type: string; text: string }[];
}

@Injectable()
export class SlackAlertService {
  private readonly logger = new Logger(SlackAlertService.name);
  private readonly botToken = process.env.SLACK_BOT_TOKEN ?? '';
  private readonly threshold = Number(
    process.env.PURCHASE_SCORE_THRESHOLD ?? 70,
  );
  private redis!: Redis;

  constructor(
    private readonly redisService: RedisService,
    @InjectRepository(UserModel)
    private readonly userRepository: Repository<UserModel>,
  ) {
    this.redis = this.redisService.getClient();
  }

  async checkAndAlert(params: SlackAlertParams): Promise<void> {
    if (params.purchaseScore < this.threshold) return;
    if (!this.botToken) return;

    const users = await this.userRepository.find();
    const connectedUsers = users.filter((u) => !!u.slackUserId);
    if (!connectedUsers.length) return;

    const alertKey = `slack_alert:${params.ticker}`;
    const alreadySent = await this.redis.get(alertKey);
    if (alreadySent) return;

    await Promise.all(
      connectedUsers.map((user) => this.sendDM(user.slackUserId!, params)),
    );

    await this.redis.set(alertKey, '1', 'EX', 3600);
  }

  private async sendDM(
    slackUserId: string,
    params: SlackAlertParams,
  ): Promise<void> {
    const zoneEmoji =
      {
        STRONG_BUY: '🚀',
        BUY: '📈',
        NEUTRAL: '➡️',
        CAUTION: '⚠️',
        WAIT: '🔴',
      }[params.purchaseZone] ?? '📊';

    const changeEmoji = params.changePercent >= 0 ? '▲' : '▼';

    // RSI 구간 설명
    const rsiLabel =
      params.rsi < 30
        ? '과매도 🔵'
        : params.rsi < 40
          ? '매수 적기 🟢'
          : params.rsi < 60
            ? '중립 ⚪'
            : params.rsi < 70
              ? '과매수 주의 🟡'
              : '과매수 🔴';

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${zoneEmoji} ${params.ticker} 매수매력도 알림`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${params.companyName}* 의 매수매력도가 *${params.purchaseScore}점* 에 도달했습니다!`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*💰 현재가*\n$${params.price.toFixed(2)} (${changeEmoji} ${Math.abs(params.changePercent).toFixed(2)}%)`,
          },
          {
            type: 'mrkdwn',
            text: `*🎯 매수구간*\n${params.purchaseZone}`,
          },
          {
            type: 'mrkdwn',
            text: `*📊 매수매력도*\n${params.purchaseScore} / 100`,
          },
          {
            type: 'mrkdwn',
            text: `*📉 RSI*\n${params.rsi.toFixed(1)} (${rsiLabel})`,
          },
          {
            type: 'mrkdwn',
            text: `*📈 50일선 대비*\n${params.above50MA > 0 ? '+' : ''}${params.above50MA.toFixed(2)}%`,
          },
          {
            type: 'mrkdwn',
            text: `*📈 200일선 대비*\n${params.above200MA > 0 ? '+' : ''}${params.above200MA.toFixed(2)}%`,
          },
          {
            type: 'mrkdwn',
            text: `*👨‍💼 애널리스트 매수 비율*\n${params.analystScore}% (${params.analystTotal}명 커버리지)`,
          },
          {
            type: 'mrkdwn',
            text: `*📡 모멘텀*\n${params.momentum.toFixed(1)} (${params.momentumSignal === 'OVERSOLD' ? '과매도 🟢' : params.momentumSignal === 'OVERBOUGHT' ? '과매수 🔴' : '중립 ⚪'})`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '_투자 판단은 본인 책임입니다._',
        },
      },
    ];

    try {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.botToken}`,
        },
        body: JSON.stringify({
          channel: slackUserId,
          blocks,
          text: `${params.ticker} 매수매력도 ${params.purchaseScore}점 도달`,
        }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        this.logger.error(
          `[Slack] DM 전송 실패 (${slackUserId}): ${data.error}`,
        );
        return;
      }

      this.logger.log(
        `[Slack] ${params.ticker} 알림 → ${slackUserId} 전송 완료`,
      );
    } catch (e) {
      const err = e as Error;
      this.logger.error(`[Slack] 전송 에러: ${err.message}`);
    }
  }
}
