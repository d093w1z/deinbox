import Image from 'next/image';
import React from 'react';

interface LogoProps {
    size?: number; // width & height
    className?: string;
}

export function Logo({ size = 40, className }: LogoProps) {
    return (
        <div className={className}>
            <Image
                src="/deinbox-logo.svg" // Place your logo file in public/logo.svg
                width={size}
                height={size}
                alt="Inbox Cleaner Logo"
                priority
            />
        </div>
    );
}
