import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { CompanyModule } from './company/company.module';
import { ProjectModule } from './project/project.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisModule } from '@songkeys/nestjs-redis';
import { ConfigModule } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { DashboardModule } from './dashboard/dashboard.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || '5432'),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl:
        process.env.NODE_ENV === 'production'
          ? { rejectUnauthorized: false }
          : false,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      autoLoadEntities: true,
    }),
    RedisModule.forRoot({
      config: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        tls:
          process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : undefined,
      },
    }),
    MailerModule.forRoot({
      transport: {
        host: process.env.MAIL_HOST,
        port: Number(process.env.MAIL_PORT),
        secure: Number(process.env.MAIL_PORT) === 465,
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.MAIL_PASS,
        },
      },
      defaults: {
        from: '"Insight Board" <noreply@insightboard.com>',
      },
    }),
    AuthModule,
    UserModule,
    CompanyModule,
    ProjectModule,
    DashboardModule,
    StatsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
