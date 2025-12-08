'use client';

import { GmailStatsResponse } from '@/types/GmailStatsResponse';
import GmailStats from './GmailCard';
import { TableChartAreaInteractive } from './table-chart-area-interactive';
import { EmailTable } from './email-table';

export function DashboardContainer({ data }: { data: GmailStatsResponse }) {
    return (
        <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                    {/* <SectionCards /> */}
                    <GmailStats data={data} />

                    <EmailTable data={data?.emails} />
                    <div className="px-4 lg:px-6">{/* <ChartAreaInteractive /> */}</div>
                    <div className="px-4 lg:px-6">
                        <TableChartAreaInteractive data={data} />
                    </div>
                </div>
            </div>
        </div>
    );
}
