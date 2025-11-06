
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from '@google/genai';
import { TranscriptionEntry } from './types';
import StatusIndicator from './components/StatusIndicator';
import Login from './components/Login';

// --- Audio Utility Functions ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}


// --- Main App Component ---

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
  const [transcriptionHistory, setTranscriptionHistory] = useState<TranscriptionEntry[]>([]);
  const [currentTranscription, setCurrentTranscription] = useState({ user: '', gemini: '' });
  // FIX: Use a ref to hold the accumulating transcription to avoid stale closures in the onmessage callback.
  const currentTranscriptionRef = useRef({ user: '', gemini: '' });
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptionHistory, currentTranscription]);


  const stopConversation = useCallback(() => {
    console.log("Stopping conversation and cleaning up resources.");
    if (sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => session.close());
        sessionPromiseRef.current = null;
    }
    
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;

    mediaStreamSourceRef.current?.disconnect();
    mediaStreamSourceRef.current = null;
    
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
    
    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
      inputAudioContextRef.current.close();
    }
    inputAudioContextRef.current = null;

    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
      outputAudioContextRef.current.close();
    }
    outputAudioContextRef.current = null;
    
    audioSourcesRef.current.forEach(source => source.stop());
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    
    setStatus('idle');
  }, []);

  const handleStartConversation = useCallback(async () => {
    setStatus('connecting');
    currentTranscriptionRef.current = { user: '', gemini: '' };
    setCurrentTranscription({ user: '', gemini: '' });
    setTranscriptionHistory([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

      // FIX: Cast window to `any` to allow for `webkitAudioContext` for older browser compatibility without TypeScript errors.
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      // FIX: iOS Safari requires AudioContext to be resumed from user interaction
      if (inputAudioContextRef.current.state === 'suspended') {
        await inputAudioContextRef.current.resume();
      }
      if (outputAudioContextRef.current.state === 'suspended') {
        await outputAudioContextRef.current.resume();
      }

      // Define function for fetching message from webhook
      const getMyMessageFunction = {
        name: 'get_my_message',
        description: 'Fetches a message from the user\'s webhook. Call this when the user asks to "get my message", "fetch my message", "retrieve my message", or similar requests.',
      };

      const getLynchStockScoreFunction = {
        name: 'get_lynch_stock_score',
        description: 'Fetches Lynch score and stock analysis for a given stock ticker. Call this when the user asks for "lynch score", "stock analysis", or mentions a stock ticker symbol. This function takes about 10 seconds to complete.',
        parameters: {
          type: 'object',
          properties: {
            ticker: {
              type: 'string',
              description: 'The stock ticker symbol (e.g., "KO", "AAPL", "MSFT")',
            },
          },
          required: ['ticker'],
        },
        behavior: 'NON_BLOCKING',  // Allow async execution for long-running calls
      };

      const controlGardenLampFunction = {
        name: 'control_garden_lamp',
        description: 'Controls the garden lamps by turning them on or off. Call this when the user asks to "turn on the garden lamps", "turn off the garden lights", "switch on/off the garden", or similar requests.',
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              enum: ['on', 'off'],
              description: 'The action to perform: "on" to turn on the lamps, "off" to turn them off',
            },
          },
          required: ['action'],
        },
      };

      const tools = [{
        functionDeclarations: [getMyMessageFunction, getLynchStockScoreFunction, controlGardenLampFunction]
      }];

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: 'You are a friendly and helpful conversational AI. Keep your responses concise and natural. When the user asks you to get their message, use the get_my_message function. When the user asks for a Lynch score or stock analysis for a ticker, use the get_lynch_stock_score function with the ticker symbol they mention. The stock analysis takes about 10 seconds, so acknowledge the request and let the user know you\'re fetching the data. When the results arrive, interrupt to share them immediately. When the user asks to turn on or off the garden lamps/lights, use the control_garden_lamp function with the appropriate action (on or off).',
          tools: tools,
        },
        callbacks: {
          onopen: () => {
            console.log('Session opened.');
            setStatus('listening');

            const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
            mediaStreamSourceRef.current = source;
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromiseRef.current?.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle function calls from Gemini
            if (message.toolCall) {
              console.log('Function call received:', message.toolCall);
              const functionResponses = [];
              
              for (const fc of message.toolCall.functionCalls || []) {
                if (fc.name === 'get_my_message') {
                  console.log('Fetching message from webhook...');
                  try {
                    const webhookUrl = process.env.WEBHOOK_URL as string;
                    if (!webhookUrl) {
                      throw new Error('WEBHOOK_URL environment variable not set');
                    }
                    
                    const response = await fetch(webhookUrl);
                    const data = await response.json();
                    const message = data.message || 'No message found';
                    
                    console.log('Webhook response:', message);
                    
                    functionResponses.push({
                      id: fc.id,
                      name: fc.name,
                      response: { message: message }
                    });
                  } catch (error) {
                    console.error('Error fetching webhook:', error);
                    functionResponses.push({
                      id: fc.id,
                      name: fc.name,
                      response: { error: 'Failed to fetch message from webhook' }
                    });
                  }
                } else if (fc.name === 'get_lynch_stock_score') {
                  console.log('Fetching Lynch score for stock:', fc.args);
                  try {
                    const stockWebhookUrl = process.env.WEBHOOK_LYNCH_STOCK as string;
                    if (!stockWebhookUrl) {
                      throw new Error('WEBHOOK_LYNCH_STOCK environment variable not set');
                    }
                    
                    const ticker = fc.args?.ticker || '';
                    if (!ticker) {
                      throw new Error('No ticker provided');
                    }
                    
                    console.log('Fetching Lynch score for ticker:', ticker);
                    
                    const lynchToken = process.env.WEBHOOK_LYNCH_TOKEN as string;
                    if (!lynchToken) {
                      throw new Error('WEBHOOK_LYNCH_TOKEN environment variable not set');
                    }
                    
                    const response = await fetch(stockWebhookUrl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        token: lynchToken,
                        tickers: [ticker.toUpperCase()]
                      })
                    });
                    
                    const data = await response.json();
                    console.log('Stock webhook response:', data);
                    
                    if (data.results && data.results.length > 0) {
                      const stockData = data.results[0];
                      const summary = `${stockData['Company Name']} (${stockData.Ticker}) has a Lynch Score of ${stockData['Lynch Score']}, which is ${stockData['Score Category']}. The P/E ratio is ${stockData['P/E Ratio']}, with earnings growth of ${stockData['Earnings Growth %']}% and revenue growth of ${stockData['Revenue Growth %']}%. The company is in the ${stockData.Sector} sector, specifically ${stockData.Industry}.`;
                      
                      functionResponses.push({
                        id: fc.id,
                        name: fc.name,
                        response: { 
                          summary: summary,
                          data: stockData,
                          scheduling: 'INTERRUPT'  // Interrupt to announce results immediately
                        }
                      });
                    } else {
                      functionResponses.push({
                        id: fc.id,
                        name: fc.name,
                        response: { 
                          error: 'No stock data found for ticker: ' + ticker,
                          scheduling: 'INTERRUPT'
                        }
                      });
                    }
                  } catch (error) {
                    console.error('Error fetching stock data:', error);
                    functionResponses.push({
                      id: fc.id,
                      name: fc.name,
                      response: { 
                        error: 'Failed to fetch stock data: ' + (error instanceof Error ? error.message : 'Unknown error'),
                        scheduling: 'INTERRUPT'
                      }
                    });
                  }
                } else if (fc.name === 'control_garden_lamp') {
                  console.log('Controlling garden lamp:', fc.args);
                  try {
                    const lampWebhookUrl = process.env.WEBHOOK_LAMP_GARDENPOST as string;
                    if (!lampWebhookUrl) {
                      throw new Error('WEBHOOK_LAMP_GARDENPOST environment variable not set');
                    }
                    
                    const action = fc.args?.action || '';
                    if (!action || (action !== 'on' && action !== 'off')) {
                      throw new Error('Invalid action. Must be "on" or "off"');
                    }
                    
                    console.log('Turning garden lamps:', action);
                    console.log('Lamp webhook URL:', lampWebhookUrl);
                    
                    // Use the server-side proxy to avoid CORS issues
                    const response = await fetch('/api/webhook-proxy', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        webhookUrl: lampWebhookUrl,
                        action: action
                      })
                    });
                    
                    // Check if response is ok
                    if (!response.ok) {
                      throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    console.log('Lamp webhook response:', data);
                    
                    // Validate response structure (similar to Lynch stock)
                    const result = data.result || data.message || `Garden lamps turned ${action}`;
                    
                    functionResponses.push({
                      id: fc.id,
                      name: fc.name,
                      response: { 
                        result: result,
                        status: 'success',
                        scheduling: 'INTERRUPT'  // Match Lynch stock pattern
                      }
                    });
                  } catch (error) {
                    console.error('Error controlling garden lamp:', error);
                    functionResponses.push({
                      id: fc.id,
                      name: fc.name,
                      response: { 
                        error: 'Failed to control garden lamp: ' + (error instanceof Error ? error.message : 'Unknown error'),
                        scheduling: 'INTERRUPT'  // Match Lynch stock pattern
                      }
                    });
                  }
                }
              }
              
              if (functionResponses.length > 0) {
                const session = await sessionPromiseRef.current;
                if (session) {
                  await session.sendToolResponse({ functionResponses });
                }
              }
            }

            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              setStatus('speaking');
              const outputCtx = outputAudioContextRef.current!;
              
              // FIX: Ensure AudioContext is running before playback (iOS Safari fix)
              if (outputCtx.state === 'suspended') {
                await outputCtx.resume();
              }
              
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              
              const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputCtx.destination);
              
              source.addEventListener('ended', () => {
                audioSourcesRef.current.delete(source);
                if (audioSourcesRef.current.size === 0) {
                   setStatus('listening');
                }
              });
              
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              audioSourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
                console.log('Interrupted');
                audioSourcesRef.current.forEach(source => source.stop());
                audioSourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }

            // FIX: Use ref for accumulating transcription to prevent stale state issues in callback.
            if(message.serverContent?.inputTranscription) {
                currentTranscriptionRef.current.user += message.serverContent.inputTranscription.text;
                setCurrentTranscription({ ...currentTranscriptionRef.current });
            }
             if(message.serverContent?.outputTranscription) {
                currentTranscriptionRef.current.gemini += message.serverContent.outputTranscription.text;
                setCurrentTranscription({ ...currentTranscriptionRef.current });
            }

            if(message.serverContent?.turnComplete) {
                const { user, gemini } = currentTranscriptionRef.current;
                
                if (user || gemini) {
                    setTranscriptionHistory(prev => {
                        const newEntries: TranscriptionEntry[] = [];
                        if (user) {
                            newEntries.push({ speaker: 'user', text: user });
                        }
                        if (gemini) {
                            newEntries.push({ speaker: 'gemini', text: gemini });
                        }
                        return [...prev, ...newEntries];
                    });
                }

                currentTranscriptionRef.current = { user: '', gemini: '' };
                setCurrentTranscription({ user: '', gemini: '' });
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Session error:', e);
            setStatus('error');
            stopConversation();
          },
          onclose: () => {
            console.log('Session closed.');
            stopConversation();
          },
        },
      });

    } catch (error) {
      console.error('Failed to start conversation:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        name: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      setStatus('error');
      stopConversation();
    }
  // FIX: Remove transcription state from dependency array to prevent re-creating the callback on every partial transcription update.
  }, [stopConversation]);

  const toggleConversation = () => {
    if (status === 'listening' || status === 'speaking' || status === 'connecting') {
      stopConversation();
    } else {
      handleStartConversation();
    }
  };
  
  const isConversationActive = status === 'listening' || status === 'speaking' || status === 'connecting';

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-2xl mx-auto flex flex-col h-[90vh] bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        <header className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
            Gemini Live Conversation
          </h1>
          <div className="flex items-center gap-3">
            <StatusIndicator status={status} />
            <button
              onClick={() => {
                stopConversation();
                setIsAuthenticated(false);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-700 hover:bg-red-600 transition-colors duration-200 text-gray-300 hover:text-white"
              title="Exit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>
        
        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          {transcriptionHistory.length === 0 && !currentTranscription.user && !currentTranscription.gemini && (
             <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                 <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                 <p className="font-medium">Press the button below to start the conversation.</p>
             </div>
          )}

          {transcriptionHistory.map((entry, index) => (
            <div key={index} className={`flex items-start gap-3 ${entry.speaker === 'user' ? 'justify-end' : ''}`}>
              {entry.speaker === 'gemini' && <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0"></div>}
              <div className={`max-w-md p-3 rounded-lg ${entry.speaker === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-200 rounded-bl-none'}`}>
                <p>{entry.text}</p>
              </div>
            </div>
          ))}

          {currentTranscription.user && (
            <div className="flex items-start gap-3 justify-end opacity-70">
                <div className="max-w-md p-3 rounded-lg bg-blue-600/80 text-white rounded-br-none">
                    <p>{currentTranscription.user}</p>
                </div>
            </div>
          )}
          {currentTranscription.gemini && (
             <div className="flex items-start gap-3 opacity-70">
                 <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex-shrink-0"></div>
                 <div className="max-w-md p-3 rounded-lg bg-gray-700/80 text-gray-200 rounded-bl-none">
                    <p>{currentTranscription.gemini}</p>
                </div>
            </div>
          )}

          <div ref={transcriptEndRef} />
        </main>
        
        <footer className="p-4 border-t border-gray-700">
          <button
            onClick={toggleConversation}
            disabled={status === 'connecting'}
            className={`w-full flex items-center justify-center gap-2 px-6 py-4 text-lg font-semibold rounded-lg transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-opacity-50
              ${isConversationActive 
                ? 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500' 
                : 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'}
              ${status === 'connecting' ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isConversationActive ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              )}
            </svg>
            <span>{isConversationActive ? 'Stop Conversation' : 'Start Conversation'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
};

export default App;
