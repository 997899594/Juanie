import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, decimal, integer, index, foreignKey } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';
import { organizations } from './organizations.schema';

export const costTracking = pgTable(
  'cost_tracking',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    
    // Cost Period
    period: jsonb('period').$type<{
      type: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
      startDate: string; // ISO date
      endDate: string; // ISO date
      timezone?: string;
    }>().notNull(),
    
    // Total Cost
    totalCost: decimal('total_cost', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    
    // Service Cost Breakdown
    serviceCosts: jsonb('service_costs').$type<{
      compute?: {
        instances?: number;
        containers?: number;
        serverless?: number;
        kubernetes?: number;
      };
      storage?: {
        blockStorage?: number;
        objectStorage?: number;
        database?: number;
        backup?: number;
      };
      networking?: {
        dataTransfer?: number;
        loadBalancer?: number;
        cdn?: number;
        vpn?: number;
      };
      database?: {
        relational?: number;
        nosql?: number;
        cache?: number;
        analytics?: number;
      };
      monitoring?: {
        logs?: number;
        metrics?: number;
        traces?: number;
        alerts?: number;
      };
      security?: {
        certificates?: number;
        secrets?: number;
        scanning?: number;
        compliance?: number;
      };
      other?: Record<string, number>;
    }>(),
    
    // Resource Utilization
    resourceUtilization: jsonb('resource_utilization').$type<{
      compute?: {
        cpuUtilization?: number; // percentage
        memoryUtilization?: number; // percentage
        storageUtilization?: number; // percentage
        networkUtilization?: number; // percentage
      };
      efficiency?: {
        rightSizing?: {
          overProvisioned?: number; // percentage
          underProvisioned?: number; // percentage
          optimal?: number; // percentage
        };
        scheduling?: {
          idle?: number; // hours
          peak?: number; // hours
          average?: number; // percentage
        };
      };
      recommendations?: Array<{
        type: 'downsize' | 'upsize' | 'terminate' | 'schedule' | 'migrate';
        resource: string;
        currentCost: number;
        projectedCost: number;
        savings: number;
        confidence: number;
      }>;
    }>(),
    
    // Cost Allocation
    costAllocation: jsonb('cost_allocation').$type<{
      byTeam?: Record<string, number>;
      byEnvironment?: {
        development?: number;
        staging?: number;
        production?: number;
        testing?: number;
      };
      byApplication?: Record<string, number>;
      byRegion?: Record<string, number>;
      byTags?: Record<string, number>;
      unallocated?: number;
    }>(),
    
    // Optimization Opportunities
    optimizationOpportunities: jsonb('optimization_opportunities').$type<{
      immediate?: Array<{
        type: string;
        description: string;
        potentialSavings: number;
        effort: 'low' | 'medium' | 'high';
        impact: 'low' | 'medium' | 'high';
        timeline: string;
      }>;
      longTerm?: Array<{
        type: string;
        description: string;
        potentialSavings: number;
        effort: 'low' | 'medium' | 'high';
        impact: 'low' | 'medium' | 'high';
        timeline: string;
      }>;
      reservedInstances?: {
        recommendations?: Array<{
          instanceType: string;
          region: string;
          term: '1year' | '3year';
          paymentOption: 'no-upfront' | 'partial-upfront' | 'all-upfront';
          monthlySavings: number;
          totalSavings: number;
        }>;
      };
      spotInstances?: {
        eligible?: Array<{
          service: string;
          currentCost: number;
          spotCost: number;
          savings: number;
          availability: number;
        }>;
      };
    }>(),
    
    // Sustainability Metrics
    sustainabilityMetrics: jsonb('sustainability_metrics').$type<{
      carbonFootprint?: {
        total?: number; // kg CO2
        perDollar?: number; // kg CO2 per USD
        breakdown?: {
          compute?: number;
          storage?: number;
          networking?: number;
        };
      };
      energyConsumption?: {
        total?: number; // kWh
        renewable?: number; // percentage
        breakdown?: {
          compute?: number;
          storage?: number;
          networking?: number;
        };
      };
      efficiency?: {
        pue?: number; // Power Usage Effectiveness
        cue?: number; // Carbon Usage Effectiveness
        wue?: number; // Water Usage Effectiveness
      };
      greenMetrics?: {
        greenRegions?: number; // percentage of workload in green regions
        sustainableServices?: number; // percentage using sustainable services
        carbonNeutral?: boolean;
      };
    }>(),
    
    // Budget & Forecasting
    budgetForecasting: jsonb('budget_forecasting').$type<{
      budget?: {
        allocated?: number;
        spent?: number;
        remaining?: number;
        utilization?: number; // percentage
      };
      forecast?: {
        nextMonth?: number;
        nextQuarter?: number;
        nextYear?: number;
        confidence?: number; // percentage
        methodology?: string;
      };
      trends?: {
        growthRate?: number; // percentage
        seasonality?: Record<string, number>;
        anomalies?: Array<{
          date: string;
          expected: number;
          actual: number;
          variance: number;
        }>;
      };
      alerts?: Array<{
        type: 'budget-exceeded' | 'forecast-high' | 'anomaly-detected';
        threshold: number;
        current: number;
        severity: 'low' | 'medium' | 'high';
        timestamp: string;
      }>;
    }>(),
    
    // Cost Anomalies
    costAnomalies: jsonb('cost_anomalies').$type<{
      detected?: Array<{
        date: string;
        service: string;
        expected: number;
        actual: number;
        variance: number;
        severity: 'low' | 'medium' | 'high';
        rootCause?: string;
        resolved?: boolean;
      }>;
      patterns?: Array<{
        type: 'spike' | 'drift' | 'seasonal' | 'step-change';
        description: string;
        frequency: string;
        impact: number;
      }>;
      thresholds?: {
        daily?: number;
        weekly?: number;
        monthly?: number;
      };
    }>(),
    
    // Billing Information
    billingInfo: jsonb('billing_info').$type<{
      provider?: 'aws' | 'gcp' | 'azure' | 'multi-cloud';
      accounts?: Array<{
        id: string;
        name: string;
        cost: number;
        percentage: number;
      }>;
      invoices?: Array<{
        id: string;
        date: string;
        amount: number;
        status: 'pending' | 'paid' | 'overdue';
      }>;
      paymentMethods?: Array<{
        type: 'credit-card' | 'bank-transfer' | 'invoice';
        status: 'active' | 'expired' | 'failed';
      }>;
      credits?: {
        available?: number;
        used?: number;
        expiring?: Array<{
          amount: number;
          expiryDate: string;
        }>;
      };
    }>(),
    
    // Relationships
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    
    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// 索引定义
export const costTrackingIndexes = {
  projectIdIdx: index('cost_tracking_project_id_idx').on(costTracking.projectId),
  organizationIdIdx: index('cost_tracking_organization_id_idx').on(costTracking.organizationId),
  periodIdx: index('cost_tracking_period_idx').on(costTracking.period),
  totalCostIdx: index('cost_tracking_total_cost_idx').on(costTracking.totalCost),
  createdAtIdx: index('cost_tracking_created_at_idx').on(costTracking.createdAt),
};

// Zod schemas for validation
export const insertCostTrackingSchema = createInsertSchema(costTracking);

export const selectCostTrackingSchema = createSelectSchema(costTracking);

export const updateCostTrackingSchema = selectCostTrackingSchema.pick({
  period: true,
  totalCost: true,
  currency: true,
  serviceCosts: true,
  resourceUtilization: true,
  costAllocation: true,
  optimizationOpportunities: true,
  sustainabilityMetrics: true,
  budgetForecasting: true,
  costAnomalies: true,
  billingInfo: true,
  projectId: true,
  organizationId: true,
}).partial();

export const costTrackingPublicSchema = selectCostTrackingSchema.pick({
  id: true,
  period: true,
  totalCost: true,
  currency: true,
  serviceCosts: true,
  resourceUtilization: true,
  sustainabilityMetrics: true,
  createdAt: true,
});

export type CostTracking = typeof costTracking.$inferSelect;
export type NewCostTracking = typeof costTracking.$inferInsert;
export type UpdateCostTracking = z.infer<typeof updateCostTrackingSchema>;
export type CostTrackingPublic = z.infer<typeof costTrackingPublicSchema>;