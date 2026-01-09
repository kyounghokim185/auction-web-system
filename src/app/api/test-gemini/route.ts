
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return NextResponse.json({ message: "API Key Missing" }, { status: 500 });

        const apiEndpoint = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello, confirm connection." }] }]
            })
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error.message);

        return NextResponse.json({
            message: "아이파크몰 시스템 연결 성공",
            detail: data
        });

    } catch (e: any) {
        return NextResponse.json({ message: e.message }, { status: 500 });
    }
}
