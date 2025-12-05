'use client';

import { GmailStatsResponse } from '@/types/GmailStatsResponse';
import { useState, useEffect } from 'react';
import GmailStats from './GmailCard';
import { TableChartAreaInteractive } from './table-chart-area-interactive';
import { EmailSchema } from '@/types/EmailSchema';
import { EmailTable } from './email-table';

export default function DashboardComponent({ data }: { data: GmailStatsResponse }) {
    return (
        <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <GmailStats data={data} />
            <EmailTable data={data?.emails} />
            <div className="px-4 lg:px-6">{/* <ChartAreaInteractive /> */}</div>
            <div className="px-4 lg:px-6">
                <TableChartAreaInteractive data={data} />
            </div>
        </div>
    );
}
