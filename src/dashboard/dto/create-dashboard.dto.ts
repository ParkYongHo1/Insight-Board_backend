import { IsString, IsArray, IsOptional } from 'class-validator';

export enum DashboardCondition {
  EQ = 'EQ',
  NE = 'NE',
  GT = 'GT',
  LT = 'LT',
  GE = 'GE',
  LE = 'LE',
  IN_RANGE = 'IN_RANGE',
}

export enum DashboardStatType {
  RAW = 'RAW',
  SUM = 'SUM',
  AVG = 'AVG',
  COUNT = 'COUNT',
}

export class CreateDashboardDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  desc?: string;

  @IsArray()
  groups: any[];

  @IsArray()
  metrics: any[]; // 💡 DTO 단에서 유연하게 배열을 수용한 뒤 서비스에서 정밀 정제합니다.

  @IsOptional()
  @IsString()
  author?: string;
}
