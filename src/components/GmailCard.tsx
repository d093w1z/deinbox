'use client';
import { useEffect, useState } from 'react';
import { EmailTable, schema } from './email-table';
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

interface Profile {
    /**
     * The user's email address.
     */
    emailAddress?: string | null;
    /**
     * The ID of the mailbox's current history record.
     */
    historyId?: string | null;
    /**
     * The total number of messages in the mailbox.
     */
    messagesTotal?: number | null;
    /**
     * The total number of threads in the mailbox.
     */
    threadsTotal?: number | null;
}
// Define types for the response structure
interface GmailStatsResponse {
    emails: (typeof schema)[];
    profile: Profile;
    recentEmailCount: number;
    stats: {
        totalEmails: number;
        unreadCount: number;
        oldEmailsCount: number;
        categoryCounts: Record<string, number>;
        senderFrequency: Record<string, number>;
        attachmentSize: number;
    };
    unsubscribeList: {
        messageId: string;
        unsubscribeUrl?: string;
        unsubscribeEmail?: string;
        sender: string;
    }[];
    error: string | undefined | null;
}

export default function GmailCard() {
    const [data, setData] = useState<GmailStatsResponse | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            const res = await fetch('/emaildata.json');
            const json = await res.json();
            // console.log(json);
            setData(json);
        };

        fetchStats();
    }, []);

    if (!data) return <div>Loading Gmail data...</div>;
    if (data.error) return <div>Error fetching data</div>;
    return (
        <>
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
                                                    <Badge variant="outline">
                                                        {count}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </CardFooter>
                </Card>
            </div>

            {/* <h3>Top Senders:</h3>
      <ul>
        {Object.entries(data.stats.senderFrequency)
          .slice(0, 5)
          .map(([sender, count]) => (
            <li key={sender}>
              {sender}: {count}
            </li>
          ))}
      </ul> */}
            <EmailTable data={data.emails.map((email) => schema.parse(email))} />
        </>
    );
}
