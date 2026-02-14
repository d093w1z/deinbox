'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';

const chartConfig = {
    count: {
        label: 'Emails',
        color: 'var(--primary)',
    },
} satisfies ChartConfig;

interface StorageByCategoryRow {
    month: string | Date;
    category: string;
    count: string | number;
}

export function MonthlyEmailChart({
    storageByCategory,
}: {
    storageByCategory: StorageByCategoryRow[];
}) {
    const chartData = React.useMemo(() => {
        const totalsByMonth = new Map<string, number>();
        for (const row of storageByCategory) {
            const key = new Date(row.month).toISOString().slice(0, 7); // YYYY-MM
            totalsByMonth.set(
                key,
                (totalsByMonth.get(key) ?? 0) + Number(row.count),
            );
        }
        return Array.from(totalsByMonth.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, count]) => ({ month, count }));
    }, [storageByCategory]);

    if (chartData.length === 0) return null;

    return (
        <Card className='@container/card'>
            <CardHeader>
                <CardTitle>Emails over time</CardTitle>
                <CardDescription>
                    Synced emails received per month
                </CardDescription>
            </CardHeader>
            <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
                <ChartContainer
                    config={chartConfig}
                    className='aspect-auto h-[250px] w-full'
                >
                    <AreaChart data={chartData}>
                        <defs>
                            <linearGradient
                                id='fillCount'
                                x1='0'
                                y1='0'
                                x2='0'
                                y2='1'
                            >
                                <stop
                                    offset='5%'
                                    stopColor='var(--color-count)'
                                    stopOpacity={0.8}
                                />
                                <stop
                                    offset='95%'
                                    stopColor='var(--color-count)'
                                    stopOpacity={0.1}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey='month'
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={32}
                            tickFormatter={(value: string) => {
                                const [year, month] = value.split('-');
                                return new Date(
                                    Number(year),
                                    Number(month) - 1,
                                ).toLocaleDateString('en-US', {
                                    month: 'short',
                                    year: '2-digit',
                                });
                            }}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            allowDecimals={false}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    labelFormatter={(value: string) => {
                                        const [year, month] = value.split('-');
                                        return new Date(
                                            Number(year),
                                            Number(month) - 1,
                                        ).toLocaleDateString('en-US', {
                                            month: 'long',
                                            year: 'numeric',
                                        });
                                    }}
                                    indicator='dot'
                                />
                            }
                        />
                        <Area
                            dataKey='count'
                            type='monotone'
                            fill='url(#fillCount)'
                            stroke='var(--color-count)'
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}
