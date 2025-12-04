import { AICategorizerService } from '@/lib/ai-categorizer';
import { authOptions } from '@/lib/auth';
import { getGmailService } from '@/lib/gmail';
import { getCacheService } from '@/lib/redis';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cache = getCacheService();
    const cacheKey = `ai-suggestions:${session.user.email}`;
    const cached = await cache.get(cacheKey);
    if (cached) return NextResponse.json(cached);

    const gmail = await getGmailService();
    const messages = await gmail.getMessages('', 500);

    const ai = new AICategorizerService();
    const result = {
        suggestions: ai.generateCleanupSuggestions(messages),
        interactionPatterns: ai.analyzeInteractionPatterns(messages),
        smartFilters: ai.getSmartFilters(),
    };

    await cache.set(cacheKey, result, 7200);
    return NextResponse.json(result);
}
