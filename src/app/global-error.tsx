'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang='en' suppressHydrationWarning>
            <body>
                <div className='bg-background flex min-h-screen items-center justify-center p-4'>
                    <div className='bg-card w-full max-w-md rounded-lg border p-6 shadow-lg'>
                        <h2 className='mb-4 text-xl font-bold'>
                            Application Error
                        </h2>
                        <p className='text-muted-foreground mb-4 text-sm'>
                            {error.message ||
                                'Something went wrong with the application'}
                        </p>
                        {error.digest && (
                            <p className='text-muted-foreground mb-4 text-xs'>
                                Error ID: {error.digest}
                            </p>
                        )}
                        <button
                            onClick={reset}
                            className='bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-md px-4 py-2'
                        >
                            Try again
                        </button>
                    </div>
                </div>
            </body>
        </html>
    );
}
