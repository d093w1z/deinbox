'use client';
import { useEffect, useState } from 'react';
import {
    Card,
    CardAction,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from './ui/badge';
import React from 'react';
import { GmailStatsResponse } from '@/types/GmailStatsResponse';
import { EmailSchema } from '@/types/EmailSchema';

export default function GmailCard({ data }: { data: GmailStatsResponse | null }) {
    if (!data) return <div>Loading Gmail data...</div>;
    if (data.error) return <div>Error fetching data</div>;
    return (
        <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Total Emails:</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {data.stats.totalEmails}
                    </CardTitle>
                    <CardAction></CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                        <strong>Unread:</strong> {data.stats.unreadCount}
                    </div>
                    <div className="text-muted-foreground">
                        <strong>Old Emails:</strong> {data.stats.oldEmailsCount}
                    </div>
                </CardFooter>
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Total Emails:</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {data.stats.totalEmails}
                    </CardTitle>
                    <CardAction></CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                        <strong>Unread:</strong> {data.stats.unreadCount}
                    </div>
                    <div className="text-muted-foreground">
                        <strong>Old Emails:</strong> {data.stats.oldEmailsCount}
                    </div>
                </CardFooter>
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Total Emails:</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                        {data.stats.totalEmails}
                    </CardTitle>
                    <CardAction></CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                        <strong>Unread:</strong> {data.stats.unreadCount}
                    </div>
                    <div className="text-muted-foreground">
                        <strong>Old Emails:</strong> {data.stats.oldEmailsCount}
                    </div>
                </CardFooter>
            </Card>
            <Card className="@container/card">
                <CardHeader>
                    <CardDescription>Top Senders:</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl"></CardTitle>
                    <CardAction></CardAction>
                </CardHeader>
                <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex gap-2 font-medium">
                        <table>
                            <tbody>
                                {Object.entries(data.stats.senderFrequency)
                                    .slice(0, 5)
                                    .map(([sender, count]) => (
                                        <tr key={sender}>
                                            <td className="pr-1.5">{sender}</td>
                                            <td>
                                                <Badge variant="outline">{count}</Badge>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}
