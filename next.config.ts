import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    serverExternalPackages: ['bull'],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'lh3.googleusercontent.com',
            },
        ],
    },
};

export default nextConfig;
