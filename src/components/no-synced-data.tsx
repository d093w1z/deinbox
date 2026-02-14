import { Button } from '@/components/ui/button';
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';

export function NoSyncedData({
    description = 'This is built from your synced inbox. Run a sync to see it here.',
}: {
    description?: string;
}) {
    return (
        <div className='px-4 lg:px-6'>
            <Card>
                <CardHeader>
                    <CardTitle>No synced data yet</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardFooter>
                    <Button asChild>
                        <Link href='/sync-status'>Go to Sync Status</Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
