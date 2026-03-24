import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';

export const apiRouter = Router();

function isOllamaModelId(modelId: string): boolean {
  if (modelId === 'ollama') return true;
  if (modelId.startsWith('gpt') || modelId.startsWith('claude') || modelId.startsWith('gemini')) {
    return false;
  }
  return (
    modelId.startsWith('llama') ||
    modelId.startsWith('qwen') ||
    modelId.startsWith('mistral') ||
    modelId.startsWith('phi') ||
    modelId.startsWith('gemma') ||
    modelId.startsWith('codellama') ||
    modelId.startsWith('deepseek') ||
    modelId.includes(':')
  );
}

async function resolveOllamaModelName(modelId: string, ollamaUrl: string): Promise<string> {
  if (modelId !== 'ollama') return modelId;
  const fromEnv = process.env.OLLAMA_DEFAULT_MODEL?.trim();
  if (fromEnv) return fromEnv;
  try {
    const r = await fetch(`${ollamaUrl}/api/tags`);
    const j = await r.json();
    const first = j.models?.[0]?.name;
    if (first) return first;
  } catch {
    /* ignore */
  }
  return 'llama3.2';
}

// In-memory store for debate sessions
interface DebateSession {
  id: string;
  topic: string;
  participants: string[];
  history: { role: string; content: string }[];
}
const debateSessions = new Map<string, DebateSession>();

// SSE Helpers
const sendSSE = (res: Response, data: any) => {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};
const sendDone = (res: Response) => {
  res.write(`data: [DONE]\n\n`);
  res.end();
};

// POST /chat/route
apiRouter.post('/chat/route', (req: Request, res: Response) => {
  const { prompt } = req.body;
  const lowerPrompt = (prompt || '').toLowerCase();

  if (/(code|debug|function|error|fix|script)/.test(lowerPrompt)) {
    return res.json({ modelId: "gpt-4o", reasoning: "Code task detected" });
  }
  if (/(write|essay|story|creative|poem)/.test(lowerPrompt)) {
    return res.json({ modelId: "claude-3-5-sonnet", reasoning: "Creative task detected" });
  }
  if (/(math|calculate|equation|solve)/.test(lowerPrompt)) {
    return res.json({ modelId: "gemini-1.5-pro", reasoning: "Math task detected" });
  }
  
  return res.json({ modelId: "gpt-4o", reasoning: "General task, using default model" });
});

// POST /chat/message
apiRouter.post('/chat/message', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { messages, modelId, rolePrompt } = req.body;
    const openAiKey = req.headers['x-openai-key'] as string;
    const anthropicKey = req.headers['x-anthropic-key'] as string;
    const googleKey = req.headers['x-google-key'] as string;
    const ollamaUrl = (req.headers['x-ollama-url'] as string) || 'http://localhost:11434';

    if (modelId.startsWith('gpt')) {
      if (!openAiKey) throw new Error("No API key provided for openai");
      const openai = new OpenAI({ apiKey: openAiKey });
      const sysMsg = rolePrompt ? [{ role: 'system', content: rolePrompt }] : [];
      
      const stream = await openai.chat.completions.create({
        model: modelId,
        messages: [...sysMsg, ...messages] as any,
        stream: true,
      });
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) sendSSE(res, { content });
      }
      
    } else if (modelId.startsWith('claude')) {
      if (!anthropicKey) throw new Error("No API key provided for anthropic");
      const anthropic = new Anthropic({ apiKey: anthropicKey });
      
      const systemMsgs = messages.filter((m: any) => m.role === 'system').map((m: any) => m.content).join('\n');
      const filteredMessages = messages.filter((m: any) => m.role !== 'system').map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));
      const finalSystem = rolePrompt ? `${rolePrompt}\n${systemMsgs}`.trim() : systemMsgs;

      const stream = await anthropic.messages.create({
        model: modelId,
        messages: filteredMessages as any,
        system: finalSystem || undefined,
        max_tokens: 4096,
        stream: true,
      });
      
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          sendSSE(res, { content: event.delta.text });
        }
      }
      
    } else if (modelId.startsWith('gemini')) {
      if (!googleKey) throw new Error("No API key provided for google");
      const ai = new GoogleGenAI({ apiKey: googleKey });
      
      let promptStr = rolePrompt ? `${rolePrompt}\n\n` : '';
      promptStr += messages.map((m: any) => `${m.role}: ${m.content}`).join('\n');

      const response = await ai.models.generateContentStream({
        model: modelId,
        contents: promptStr,
      });
      
      for await (const chunk of response) {
        if (chunk.text) {
          sendSSE(res, { content: chunk.text });
        }
      }
      
    } else if (isOllamaModelId(modelId)) {
      const ollamaModel = await resolveOllamaModelName(modelId, ollamaUrl);
      const sysMsg = rolePrompt ? [{ role: 'system', content: rolePrompt }] : [];
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages: [...sysMsg, ...messages],
          stream: true
        })
      });
      
      if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
      if (!response.body) throw new Error("No response body from Ollama");
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.trim()) {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              sendSSE(res, { content: parsed.message.content });
            }
          }
        }
      }
    } else {
      throw new Error(`Unsupported model: ${modelId}`);
    }
    
    sendDone(res);
  } catch (error: any) {
    sendSSE(res, { error: error.message });
    sendDone(res);
  }
});

// POST /debate/start
apiRouter.post('/debate/start', (req: Request, res: Response) => {
  const { topic, participants } = req.body;
  const sessionId = crypto.randomUUID();
  const models = participants && participants.length > 0 
    ? participants 
    : ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro"];
  
  debateSessions.set(sessionId, {
    id: sessionId,
    topic,
    participants: models,
    history: []
  });

  res.json({
    session_id: sessionId,
    topic,
    participants: models,
    status: "started"
  });
});

// POST /debate/round
apiRouter.post('/debate/round', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { session_id, round_number } = req.body;
    const session = debateSessions.get(session_id);
    if (!session) throw new Error("Session not found");

    const openAiKey = req.headers['x-openai-key'] as string;
    const anthropicKey = req.headers['x-anthropic-key'] as string;
    const googleKey = req.headers['x-google-key'] as string;
    const ollamaUrl = (req.headers['x-ollama-url'] as string) || 'http://localhost:11434';

    const prompt = round_number === 1 
      ? `You are participating in a structured debate. The topic is: ${session.topic}. Give your opening argument in 2-3 sentences. Be direct and assertive.`
      : `You are participating in a structured debate on: ${session.topic}. This is round ${round_number}. Based on the previous arguments, defend your position or respond to counterarguments in 2-3 sentences.`;

    for (const modelId of session.participants) {
      sendSSE(res, { type: "model_start", modelId, round: round_number });
      
      let fullResponse = "";
      const messages = [...session.history, { role: "user", content: prompt }];

      if (modelId.startsWith('gpt')) {
        if (!openAiKey) throw new Error(`No API key provided for openai`);
        const openai = new OpenAI({ apiKey: openAiKey });
        const stream = await openai.chat.completions.create({
          model: modelId,
          messages: messages as any,
          stream: true,
        });
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            sendSSE(res, { type: "token", modelId, content });
            fullResponse += content;
          }
        }
      } else if (modelId.startsWith('claude')) {
        if (!anthropicKey) throw new Error(`No API key provided for anthropic`);
        const anthropic = new Anthropic({ apiKey: anthropicKey });
        const filteredMessages = messages.filter(m => m.role !== 'system').map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content
        }));
        const stream = await anthropic.messages.create({
          model: modelId,
          messages: filteredMessages as any,
          max_tokens: 4096,
          stream: true,
        });
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            sendSSE(res, { type: "token", modelId, content: event.delta.text });
            fullResponse += event.delta.text;
          }
        }
      } else if (modelId.startsWith('gemini')) {
        if (!googleKey) throw new Error(`No API key provided for google`);
        const ai = new GoogleGenAI({ apiKey: googleKey });
        const promptStr = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const response = await ai.models.generateContentStream({
          model: modelId,
          contents: promptStr,
        });
        for await (const chunk of response) {
          if (chunk.text) {
            sendSSE(res, { type: "token", modelId, content: chunk.text });
            fullResponse += chunk.text;
          }
        }
      } else if (isOllamaModelId(modelId)) {
        const ollamaModel = await resolveOllamaModelName(modelId, ollamaUrl);
        const response = await fetch(`${ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            messages: messages,
            stream: true
          })
        });
        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
        if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (line.trim()) {
                const parsed = JSON.parse(line);
                if (parsed.message?.content) {
                  sendSSE(res, { type: "token", modelId, content: parsed.message.content });
                  fullResponse += parsed.message.content;
                }
              }
            }
          }
        }
      } else {
        throw new Error(`Unsupported model: ${modelId}`);
      }

      sendSSE(res, { type: "model_end", modelId });
      
      session.history.push({ role: "user", content: prompt });
      session.history.push({ role: "assistant", content: fullResponse });
    }

    sendDone(res);
  } catch (error: any) {
    sendSSE(res, { error: error.message });
    sendDone(res);
  }
});

// POST /debate/vote
apiRouter.post('/debate/vote', async (req: Request, res: Response) => {
  try {
    const { session_id } = req.body;
    const session = debateSessions.get(session_id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const openAiKey = req.headers['x-openai-key'] as string;
    const anthropicKey = req.headers['x-anthropic-key'] as string;
    const googleKey = req.headers['x-google-key'] as string;
    const ollamaUrl = (req.headers['x-ollama-url'] as string) || 'http://localhost:11434';

    const prompt = `You participated in a debate on: ${session.topic}. Based on logical merit, which argument was strongest? Respond with ONLY a JSON object: {"winner": "model-id", "reasoning": "one sentence"}`;

    const votes: Array<{modelId: string, votedFor: string, reasoning: string}> = [];

    for (const modelId of session.participants) {
      const messages = [...session.history, { role: "user", content: prompt }];
      let responseText = "";

      try {
        if (modelId.startsWith('gpt')) {
          const openai = new OpenAI({ apiKey: openAiKey });
          const resp = await openai.chat.completions.create({
            model: modelId,
            messages: messages as any,
          });
          responseText = resp.choices[0]?.message?.content || "";
        } else if (modelId.startsWith('claude')) {
          const anthropic = new Anthropic({ apiKey: anthropicKey });
          const filteredMessages = messages.filter(m => m.role !== 'system').map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content
          }));
          const resp = await anthropic.messages.create({
            model: modelId,
            messages: filteredMessages as any,
            max_tokens: 1024,
          });
          responseText = (resp.content[0] as any)?.text || "";
        } else if (modelId.startsWith('gemini')) {
          const ai = new GoogleGenAI({ apiKey: googleKey });
          const promptStr = messages.map(m => `${m.role}: ${m.content}`).join('\n');
          const resp = await ai.models.generateContent({
            model: modelId,
            contents: promptStr,
          });
          responseText = resp.text || "";
        } else if (isOllamaModelId(modelId)) {
          const ollamaModel = await resolveOllamaModelName(modelId, ollamaUrl);
          const resp = await fetch(`${ollamaUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: ollamaModel,
              messages: messages,
              stream: false
            })
          });
          const data = await resp.json();
          responseText = data.message?.content || "";
        } else {
          throw new Error(`Unsupported model: ${modelId}`);
        }

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          votes.push({
            modelId,
            votedFor: parsed.winner,
            reasoning: parsed.reasoning
          });
        }
      } catch (e) {
        console.error(`Error getting vote from ${modelId}:`, e);
      }
    }

    const tally: Record<string, number> = {};
    let winner = "none";
    let maxVotes = 0;

    for (const v of votes) {
      tally[v.votedFor] = (tally[v.votedFor] || 0) + 1;
      if (tally[v.votedFor] > maxVotes) {
        maxVotes = tally[v.votedFor];
        winner = v.votedFor;
      }
    }

    res.json({ votes, winner });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /models/ollama
apiRouter.get('/models/ollama', async (req: Request, res: Response) => {
  const ollamaUrl = (req.query.ollamaUrl as string) || 'http://localhost:11434';
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) throw new Error("Ollama not reachable");
    const data = await response.json();
    const models = data.models.map((m: any) => ({
      id: m.name,
      name: m.name,
      provider: "ollama"
    }));
    res.json({ models });
  } catch (error: any) {
    res.json({ models: [], error: "Ollama not reachable" });
  }
});

// POST /models/validate-key
apiRouter.post('/models/validate-key', async (req: Request, res: Response) => {
  const { provider, apiKey } = req.body;
  try {
    if (provider === 'openai') {
      const openai = new OpenAI({ apiKey });
      await openai.models.list();
    } else if (provider === 'anthropic') {
      const anthropic = new Anthropic({ apiKey });
      await anthropic.messages.create({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
    } else if (provider === 'google') {
      const ai = new GoogleGenAI({ apiKey });
      await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: 'test',
        config: { maxOutputTokens: 1 }
      });
    } else {
      return res.json({ valid: false, error: "Unknown provider" });
    }
    res.json({ valid: true });
  } catch (error: any) {
    res.json({ valid: false, error: error.message });
  }
});
