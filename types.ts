
import { LucideIcon } from 'lucide-react';

export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  INFO = 'info',
}

export interface NotificationMessage {
  id: number | null;
  message: string;
  type: NotificationType | '';
}

export interface Product {
  id: string;
  title: string;
  price: number;
  currentStock: number;
  avgDailySales: number;
  minStock: number;
  thumbnail: string;
  category?: string;
  status?: string;
  condition?: string;
  sold_quantity?: number;
  lastRestock?: string;
}

export interface StockMetrics {
  daysUntilEmpty: number | typeof Infinity;
  monthlyDemand: number;
  recommendedRestock: number;
  riskLevel: RiskLevel;
  displayDaysUntilEmpty: string;
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export interface StockHistoryEntry {
  date: string;
  estoque: number;
  vendas: number;
  estoqueMinimo: number;
}

export interface ChartConfig {
  title: string;
  type: 'line' | 'bar';
  dataKey: keyof StockHistoryEntry;
  color: string;
  yAxisLabel: string;
  secondaryKey?: keyof StockHistoryEntry;
  secondaryColor?: string;
  secondaryName?: string;
}

export interface MetricDisplayConfig {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit: string;
  color: 'blue' | 'red' | 'amber' | 'green';
}

export interface PieChartEntry {
  name: string;
  value: number;
  color: string;
}

export interface MercadoLivreTokenResponse {
  access_token: string;
  refresh_token: string;
  user_id: number;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  message?: string; // For errors from ML
  details?: { error_description?: string }; // For detailed errors from ML via backend
}