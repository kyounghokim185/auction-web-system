import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { imageUrl } = await request.json();
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ message: "GEMINI_API_KEY is missing" }, { status: 500 });
        }

        if (!imageUrl) {
            return NextResponse.json({ message: "Image URL is required" }, { status: 400 });
        }

        // 1. Fetch the image content
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) throw new Error("Failed to fetch image from Supabase");
        const arrayBuffer = await imageRes.arrayBuffer();
        const base64Image = Buffer.from(arrayBuffer).toString('base64');

        // 2. Call Gemini 1.5 Flash API
        const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const promptText = `
      Analyze this construction site photo for a renovation estimate.
      Return ONLY a JSON object with the following fields:
      - "needs_demolition": true/false (Is there debris, old structures, or things needing removal?)
      - "floor_condition": string (Brief description)
      - "wall_condition": string (Brief description)
      - "recommendations": array of strings (List of recommended construction categories from: "가설 및 철거", "바닥", "벽", "천장", "전기/통신", "설비", "소방")
      - "estimated_pyung": number (Rough estimate of the area in Pyung, if visible, else null)
    `;

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    { inline_data: { mime_type: "image/jpeg", data: base64Image } } // Assuming JPEG/PNG, API handles generic well
                ]
            }]
        };

        const geminiRes = await fetch(apiEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });

        const geminiData = await geminiRes.json();

        if (geminiData.error) {
            console.error("Gemini API Error:", geminiData.error);
            throw new Error(geminiData.error.message || "Gemini API failed");
        }

        // Parse Response
        const textResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        // Clean markdown manually if needed
        const cleanJson = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysisResult = JSON.parse(cleanJson);

        return NextResponse.json(analysisResult);

    } catch (error: any) {
        console.error("Analysis Error:", error);
        return NextResponse.json({ message: error.message || "Analysis failed" }, { status: 500 });
    }
}
