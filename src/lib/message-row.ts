import type { Email } from '@/types/EmailSchema';

// Shape shared by any query selecting these columns off email_messages.
export interface MessageRow {
    gmail_message_id: string;
    gmail_thread_id: string;
    subject: string | null;
    sender_email: string;
    sender_name: string | null;
    recipient_emails: string[] | null;
    date: Date;
    snippet: string | null;
    size_bytes: number | null;
    labels: string[] | null;
    category: string | null;
    is_unread: boolean;
    has_attachment: boolean;
}

export function mapMessageRowToEmail(row: MessageRow): Email {
    return {
        id: row.gmail_message_id,
        threadId: row.gmail_thread_id,
        snippet: row.snippet ?? '',
        historyId: '',
        internalDate: row.date.getTime().toString(),
        subject: row.subject ?? '',
        from: row.sender_name
            ? `${row.sender_name} <${row.sender_email}>`
            : row.sender_email,
        to: (row.recipient_emails ?? []).join(', '),
        date: row.date,
        labels: row.labels ?? [],
        isUnread: row.is_unread,
        hasAttachment: row.has_attachment,
        category: (row.category ?? 'primary') as Email['category'],
        size: row.size_bytes ?? 0,
    };
}
