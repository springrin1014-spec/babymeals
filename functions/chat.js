export async function onRequestPost(context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const body = await context.request.json();
    const { prompt, imageBase64, imageMimeType } = body;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'prompt is required' }), { status: 400, headers });
    }

    const GEMINI_API_KEY = context.env.GEMINI_API_KEY;
    const GEMINI_MODEL = context.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), { status: 500, headers });
    }

    const parts = [];
    if (imageBase64 && imageMimeType) {
      parts.push({ inline_data: { mime_type: imageMimeType, data: imageBase64 } });
    }
    parts.push({ text: prompt });

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    const geminiData = await geminiRes.json();

    if (!geminiRes.ok) {
      const errMsg = geminiData?.error?.message || JSON.stringify(geminiData);
      return new Response(JSON.stringify({ error: `Gemini 오류: ${errMsg}` }), { status: 500, headers });
    }

    let text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // 코드블록 제거
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    // { 부터 마지막 } 까지 추출
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      text = text.substring(start, end + 1);
    }

    // 서버에서 파싱 시도
    try {
      const parsed = JSON.parse(text);
      return new Response(JSON.stringify({ parsed }), { headers });
    } catch (e) {
      return new Response(JSON.stringify({ text }), { headers });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: `서버 오류: ${err.message}` }), { status: 500, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
