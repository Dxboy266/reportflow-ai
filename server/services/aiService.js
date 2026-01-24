const fetch = require('node-fetch');
const { getConfig } = require('../config');

async function streamAI(res, systemPrompt, userPrompt) {
    const config = getConfig();
    if (!config.ai) throw new Error("AI provider not configured");

    const provider = config.ai.provider || 'deepseek';
    const baseUrl = config.ai.baseUrl || 'https://api.deepseek.com/v1';
    const model = config.ai.model || 'deepseek-chat';
    const apiKey = config.ai.apiKey || '';
    const isAnthropic = provider === 'anthropic' || provider === 'antigravity';

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    if (isAnthropic) {
        delete headers['Authorization'];
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
    }

    const endpoint = isAnthropic ?
        (baseUrl.endsWith('/') ? `${baseUrl}messages` : `${baseUrl}/messages`) :
        (baseUrl.endsWith('/') ? `${baseUrl}chat/completions` : `${baseUrl}/chat/completions`);

    const body = isAnthropic ? {
        model,
        messages: [{ role: "user", content: `${systemPrompt}\n\nUser Input:\n${userPrompt}` }],
        system: systemPrompt,
        max_tokens: 4096,
        stream: true
    } : {
        model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 16384,
        stream: true
    };

    try {
        const aiRes = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        if (!aiRes.ok) {
            const errText = await aiRes.text();
            throw new Error(`AI API Error: ${aiRes.status} ${errText}`);
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        const stream = aiRes.body;

        stream.on('data', (chunk) => {
            const lines = chunk.toString().split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;

                let jsonStr = '';
                if (trimmed.startsWith('data: ')) {
                    jsonStr = trimmed.slice(6);
                } else if (isAnthropic && trimmed.startsWith('{')) {
                    // Anthropic raw handling if needed, but usually prefixed
                }

                if (jsonStr) {
                    try {
                        const json = JSON.parse(jsonStr);
                        let text = '';

                        if (isAnthropic) {
                            if (json.type === 'content_block_delta' && json.delta && json.delta.text) {
                                text = json.delta.text;
                            }
                        } else {
                            if (json.choices && json.choices[0].delta) {
                                const delta = json.choices[0].delta;
                                if (delta.reasoning_content) {
                                    if (!res.reasoningStarted) {
                                        res.reasoningStarted = true;
                                        text += '<think>';
                                    }
                                    text += delta.reasoning_content;
                                }
                                if (delta.content) {
                                    if (res.reasoningStarted && !res.reasoningEnded) {
                                        res.reasoningEnded = true;
                                        text += '</think>';
                                    }
                                    text += delta.content;
                                }
                            }
                        }

                        if (text) {
                            res.write(`data: ${JSON.stringify({ text })}\n\n`);
                        }
                    } catch (e) { }
                }
            }
        });

        stream.on('end', () => {
            if (res.reasoningStarted && !res.reasoningEnded) {
                res.write(`data: ${JSON.stringify({ text: '</think>' })}\n\n`);
            }
            res.write('data: [DONE]\n\n');
            res.end();
        });

    } catch (e) {
        res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
        res.end();
    }
}

module.exports = { streamAI };
