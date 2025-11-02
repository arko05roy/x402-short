import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ code: string }> }
) {
    try {
        const { code } = await params;

        // Look up the URL in database
        const { data, error } = await supabase
            .from('urls')
            .select('original_url')
            .eq('short_code', code)
            .single();

        if (error || !data) {
            return NextResponse.json(
                { error: 'Short URL not found' },
                { status: 404 }
            );
        }

        // Return the original URL for redirect
        return NextResponse.json({
            originalUrl: data.original_url
        });

    } catch (error) {
        console.error('Redirect error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}