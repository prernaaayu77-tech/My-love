
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { 
  Leaf, 
  Play, 
  Download, 
  History, 
  Trash2, 
  Volume2, 
  Sparkles,
  Loader2,
  Clock,
  Mic2,
  ShieldCheck,
  Heart,
  BookOpen,
  User,
  Zap,
  CheckCircle2,
  Baby,
  Users,
  Target,
  Upload,
  Mic,
  Square,
  RefreshCw,
  Wind,
  Info,
  Waves,
  Activity,
  Power,
  Lock,
  Unlock,
  AlertCircle,
  MessageSquare,
  Quote
} from 'lucide-react';
import { VoiceName, SpeechRequest, SpeakingStyle, VoiceProfile } from './types';
import { decode, encode, createWavFile, decodeAudioData } from './utils/audioUtils';

const SAMPLE_RATE_OUT = 24000;
const SAMPLE_RATE_IN = 16000;

interface LiveMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

const VOICE_GALLERY: VoiceProfile[] = [
  // BOYS
  { id: VoiceName.PUCK, displayName: 'Arjun', category: 'Boy', age: 'Child', toneInstruction: 'High-energy, innocent, and bright child voice.', description: 'Vibrant child voice perfect for school-level Yoga games.' },
  { id: VoiceName.CHARON, displayName: 'Kabir', category: 'Boy', age: 'Young', toneInstruction: 'Natural, slightly deep, grounded teenage boy.', description: 'Student persona for learning Ayurvedic principles.' },
  { id: VoiceName.PUCK, displayName: 'Vihaan', category: 'Boy', age: 'Young', toneInstruction: 'Serious, focused, and disciplined student voice.', description: 'Ideal for instructional Siddha guidance.' },
  
  // GIRLS
  { id: VoiceName.KORE, displayName: 'Aarya', category: 'Girl', age: 'Child', toneInstruction: 'Sweet, gentle, and slow-paced little girl.', description: 'Soft voice for childhood mindfulness sessions.' },
  { id: VoiceName.ZEPHYR, displayName: 'Isha', category: 'Girl', age: 'Young', toneInstruction: 'Clear, modern, and energetic female student.', description: 'Modern professional voice for health tips.' },
  { id: VoiceName.KORE, displayName: 'Tara', category: 'Girl', age: 'Child', toneInstruction: 'Playful, bubbly, and rhythmic child voice.', description: 'Exciting voice for nursery-level wellness.' },

  // ADULTS & ELDERS
  { id: VoiceName.FENRIR, displayName: 'Rishi', category: 'Man', age: 'Adult', toneInstruction: 'Commanding, deep, and resonant master voice.', description: 'Authoritative voice for ancient scriptures.' },
  { id: VoiceName.ZEPHYR, displayName: 'Priya', category: 'Woman', age: 'Adult', toneInstruction: 'Warm, empathetic, and nurturing adult female.', description: 'Compassionate voice for Homoeopathic consultations.' },
  { id: VoiceName.CHARON, displayName: 'Dev', category: 'Man', age: 'Adult', toneInstruction: 'Philosophical, slow, and deep male voice.', description: 'Calm instructor for deep meditation.' },
  { id: VoiceName.KORE, displayName: 'Shanti', category: 'Elder', age: 'Elder', toneInstruction: 'Aged, wise, and slightly shaky but kind grandmother voice.', description: 'Traditional "Granny" voice for home remedies.' },
  { id: VoiceName.FENRIR, displayName: 'Guruji', category: 'Elder', age: 'Elder', toneInstruction: 'Very deep, slow, and echoey ancient master voice.', description: 'The ultimate voice of Vedic authority.' },
  { id: VoiceName.ZEPHYR, displayName: 'Meera', category: 'Woman', age: 'Adult', toneInstruction: 'Rhythmic and melodic chant-like voice.', description: 'Optimized for Unani medicine recitations.' }
];

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tts' | 'changer' | 'live'>('tts');
  const [text, setText] = useState('');
  const [selectedVoiceIdx, setSelectedVoiceIdx] = useState(0);
  const [style, setStyle] = useState<SpeakingStyle>(SpeakingStyle.NATURAL);
  const [history, setHistory] = useState<SpeechRequest[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);

  // Permission State
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  // Live State
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'disconnected' | 'connecting' | 'idle' | 'listening' | 'speaking'>('disconnected');
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const liveSessionRef = useRef<any>(null);
  const liveAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const liveMessagesEndRef = useRef<HTMLDivElement>(null);

  // Temp transcription buffers
  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  // Recorder State
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const selectedVoice = VOICE_GALLERY[selectedVoiceIdx];
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Scroll to bottom of chat
  useEffect(() => {
    liveMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveMessages]);

  // Initial Permission Check
  useEffect(() => {
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        setMicPermission(result.state as any);
        result.onchange = () => setMicPermission(result.state as any);
      });
    }
  }, []);

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission('granted');
      stream.getTracks().forEach(track => track.stop());
      setError(null);
    } catch (err) {
      setMicPermission('denied');
      setError("Microphone access was denied. Please check your browser settings.");
    }
  };

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE_OUT });
    }
    return audioContextRef.current;
  };

  const stopCurrentAudio = () => {
    if (currentSourceRef.current) {
      currentSourceRef.current.stop();
      currentSourceRef.current = null;
    }
    setActiveAudioId(null);
  };

  // --- Live API Integration (Prerna Chat) ---
  const startLiveSession = async () => {
    if (micPermission !== 'granted') {
      await requestMicPermission();
      if (micPermission !== 'granted') return;
    }

    setLiveStatus('connecting');
    setLiveMessages([]);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE_IN });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: SAMPLE_RATE_OUT });
      liveAudioContextRef.current = outputCtx;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice.id } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are ${selectedVoice.displayName}, a ${selectedVoice.age} ${selectedVoice.category} expert in AYUSH. Tone: ${selectedVoice.toneInstruction}. 
          IMPORTANT CATCHPHRASE: Your very first reply in every new session MUST start exactly with: "I make mistakes but I always come back." 
          Respond very fast. When the user greets you or starts talking, prioritize speed. Keep responses short and full of Vedic wisdom.`
        },
        callbacks: {
          onopen: () => {
            setLiveStatus('idle');
            setIsLiveActive(true);
            
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const base64 = encode(new Uint8Array(int16.buffer));
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } });
              });
            };
            
            source.connect(processor);
            processor.connect(inputCtx.destination);

            // Trigger proactive greeting
            sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { data: encode(new Uint8Array(200)), mimeType: 'audio/pcm;rate=16000' } });
            });
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Handle Transcriptions
            if (msg.serverContent?.inputTranscription) {
              setLiveStatus('listening');
              currentInputTranscriptionRef.current += msg.serverContent.inputTranscription.text;
            }
            if (msg.serverContent?.outputTranscription) {
              setLiveStatus('speaking');
              currentOutputTranscriptionRef.current += msg.serverContent.outputTranscription.text;
            }

            if (msg.serverContent?.turnComplete) {
              if (currentInputTranscriptionRef.current) {
                const userMsg: LiveMessage = {
                  id: crypto.randomUUID(),
                  role: 'user',
                  text: currentInputTranscriptionRef.current,
                  timestamp: Date.now()
                };
                setLiveMessages(prev => [...prev, userMsg]);
                currentInputTranscriptionRef.current = '';
              }
              if (currentOutputTranscriptionRef.current) {
                const modelMsg: LiveMessage = {
                  id: crypto.randomUUID(),
                  role: 'model',
                  text: currentOutputTranscriptionRef.current,
                  timestamp: Date.now()
                };
                setLiveMessages(prev => [...prev, modelMsg]);
                currentOutputTranscriptionRef.current = '';
              }
              setLiveStatus('idle');
            }

            // Handle Audio
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              setLiveStatus('speaking');
              const bytes = decode(audioData);
              const buffer = await decodeAudioData(bytes, outputCtx, SAMPLE_RATE_OUT, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              audioSourcesRef.current.add(source);
              source.onended = () => {
                audioSourcesRef.current.delete(source);
                if (audioSourcesRef.current.size === 0) setLiveStatus('idle');
              };
            }

            if (msg.serverContent?.interrupted) {
              audioSourcesRef.current.forEach(s => s.stop());
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setLiveStatus('idle');
              currentOutputTranscriptionRef.current = '';
            }
          },
          onclose: () => stopLiveSession(),
          onerror: (err) => {
            console.error(err);
            setError("Live connection error.");
            stopLiveSession();
          }
        }
      });

      liveSessionRef.current = await sessionPromise;
    } catch (err) {
      setError("Failed to start session.");
      setLiveStatus('disconnected');
    }
  };

  const stopLiveSession = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    audioSourcesRef.current.forEach(s => s.stop());
    audioSourcesRef.current.clear();
    setIsLiveActive(false);
    setLiveStatus('disconnected');
    currentInputTranscriptionRef.current = '';
    currentOutputTranscriptionRef.current = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => setRecordedBlob(new Blob(chunksRef.current, { type: 'audio/webm' }));
      recorder.start();
      setIsRecording(true);
      setError(null);
    } catch (err) {
      setMicPermission('denied');
      setError("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setRecordedBlob(file);
  };

  const handleProcess = async () => {
    if (activeTab === 'tts' && !text.trim()) return setError("Please enter text.");
    if (activeTab === 'changer' && !recordedBlob) return setError("Please record or upload audio.");

    setIsGenerating(true);
    setError(null);
    stopCurrentAudio();

    const requestId = crypto.randomUUID();
    const newRequest: SpeechRequest = {
      id: requestId,
      text: activeTab === 'tts' ? text : 'Voice Conversion',
      voice: selectedVoice.id,
      style,
      timestamp: Date.now(),
      status: 'pending',
      type: activeTab
    };

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let scriptToSpeak = text;

      if (activeTab === 'changer' && recordedBlob) {
        const base64Audio = await blobToBase64(recordedBlob);
        const transcribeResponse = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: {
            parts: [
              { inlineData: { data: base64Audio, mimeType: recordedBlob.type } },
              { text: "Transcribe this audio exactly. Return ONLY the text spoken, nothing else." }
            ]
          }
        });
        scriptToSpeak = transcribeResponse.text?.trim() || "No speech detected";
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `${selectedVoice.toneInstruction}. Style: ${style}. Text: "${scriptToSpeak}"` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice.id } } },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("Synthesis failed.");

      const pcmData = decode(base64Audio);
      const audioBlob = createWavFile(pcmData, SAMPLE_RATE_OUT);

      const completedRequest: SpeechRequest = { ...newRequest, text: scriptToSpeak, audioBlob, status: 'completed' };
      setHistory(prev => [completedRequest, ...prev]);
      setText('');
      setRecordedBlob(null);
    } catch (err: any) {
      setError(err.message || "An error occurred.");
      setHistory(prev => [{ ...newRequest, status: 'failed' }, ...prev]);
    } finally {
      setIsGenerating(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(blob);
    });
  };

  const playAudio = async (request: SpeechRequest) => {
    if (!request.audioBlob) return;
    stopCurrentAudio();
    setActiveAudioId(request.id);
    const ctx = getAudioContext();
    const buffer = await ctx.decodeAudioData(await request.audioBlob.arrayBuffer());
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => setActiveAudioId(null);
    currentSourceRef.current = source;
    source.start();
  };

  const downloadAudio = (request: SpeechRequest) => {
    if (!request.audioBlob) return;
    const url = URL.createObjectURL(request.audioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AYUSH-${request.type}-${request.id.slice(0, 4)}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fdfdfb] text-slate-900 selection:bg-green-100">
      <header className="ayush-gradient text-white py-8 px-6 sticky top-0 z-50 shadow-2xl shadow-green-900/10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-5">
            <div className="bg-white/10 p-3 rounded-3xl backdrop-blur-xl border border-white/20 shadow-inner">
              <Leaf className="w-10 h-10 text-green-50 animate-pulse" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight leading-none">AYUSH <span className="text-green-200">AI</span></h1>
              <p className="text-[10px] text-white/60 font-black uppercase tracking-[0.4em] flex items-center gap-2 mt-2">
                <Sparkles className="w-3 h-3 text-yellow-300" />
                Vedic Voice Studio
              </p>
            </div>
          </div>
          
          <nav className="flex bg-black/10 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
            {['tts', 'changer', 'live'].map((t) => (
              <button 
                key={t}
                onClick={() => setActiveTab(t as any)}
                className={`px-6 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${activeTab === t ? 'bg-white text-green-900 shadow-lg' : 'text-white/70 hover:text-white uppercase'}`}
              >
                {t === 'tts' ? 'Voice Forge' : t === 'changer' ? 'Identity Swap' : 'Prerna Chat'}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-8">
          
          {/* Persona Selection */}
          <section className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black flex items-center gap-3 text-slate-800">
                <Users className="w-6 h-6 text-green-700" />
                Vedic Personas
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {VOICE_GALLERY.map((v, idx) => {
                const isSelected = selectedVoiceIdx === idx;
                return (
                  <button
                    key={`${v.displayName}-${idx}`}
                    onClick={() => {
                      setSelectedVoiceIdx(idx);
                      if (isLiveActive) stopLiveSession();
                    }}
                    className={`relative p-5 rounded-[2rem] text-left transition-all border-2 flex flex-col gap-3 group overflow-hidden ${
                      isSelected ? 'bg-green-50 border-green-600 shadow-xl' : 'bg-white border-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                        isSelected ? 'bg-green-600 text-white' : 'bg-slate-50 text-slate-400'
                      }`}>
                        {v.category === 'Boy' ? <Baby className="w-6 h-6" /> : v.category === 'Girl' ? <Heart className="w-6 h-6" /> : v.category === 'Elder' ? <Wind className="w-6 h-6" /> : <User className="w-6 h-6" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className={`text-sm font-black ${isSelected ? 'text-green-900' : 'text-slate-800'}`}>{v.displayName}</h4>
                        <p className={`text-[10px] font-bold ${isSelected ? 'text-green-700/60' : 'text-slate-400'}`}>{v.age} • {v.id}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Action Tabs Content */}
          <section className="bg-white rounded-[3rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 space-y-8 min-h-[500px]">
            {(activeTab === 'changer' || activeTab === 'live') && micPermission !== 'granted' ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-8 animate-in fade-in duration-500">
                <div className="relative w-32 h-32 bg-green-50 rounded-[2.5rem] border-2 border-green-100 flex items-center justify-center">
                  <Lock className="w-12 h-12 text-green-700" />
                </div>
                <div className="text-center max-w-sm space-y-3">
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Microphone Access Needed</h3>
                  <p className="text-sm text-slate-500">To proceed, allow microphone permissions.</p>
                </div>
                <button
                  onClick={requestMicPermission}
                  className="w-full max-w-xs py-5 rounded-[2rem] bg-green-700 text-white font-black tracking-widest shadow-xl"
                >
                  ALLOW MICROPHONE
                </button>
              </div>
            ) : activeTab === 'live' ? (
              <div className="flex flex-col h-[650px] space-y-6">
                <div className="flex items-center justify-between shrink-0">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Prerna Chat</h2>
                    <p className="text-xs text-slate-400 font-medium italic">"I make mistakes but I always come back."</p>
                  </div>
                  <div className={`px-4 py-2 rounded-full border flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                    isLiveActive ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-100 text-slate-400'
                  }`}>
                    {isLiveActive ? <Waves className="w-3 h-3 animate-pulse" /> : <Power className="w-3 h-3" />}
                    {isLiveActive ? liveStatus : 'Inactive'}
                  </div>
                </div>

                {/* Message Display Area */}
                <div className="flex-1 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {!isLiveActive && liveMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale p-10">
                      <Quote className="w-12 h-12 mb-4 text-green-700" />
                      <p className="text-[12px] font-black uppercase tracking-[0.2em] max-w-[200px]">Experience Fast Vedic Wisdom</p>
                    </div>
                  ) : (
                    <>
                      {liveMessages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                          <div className={`max-w-[85%] p-5 rounded-[2.5rem] text-sm font-medium leading-relaxed ${
                            msg.role === 'user' 
                              ? 'bg-white border border-slate-200 text-slate-700 rounded-tr-none shadow-sm' 
                              : 'bg-green-700 text-white rounded-tl-none shadow-xl shadow-green-900/10'
                          }`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-[8px] font-black uppercase tracking-widest ${msg.role === 'user' ? 'text-slate-400' : 'text-green-100/60'}`}>
                                {msg.role === 'user' ? 'You' : selectedVoice.displayName}
                              </span>
                            </div>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      
                      {/* Live Thinking Status */}
                      {liveStatus === 'listening' && (
                        <div className="flex justify-end pr-4">
                          <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 bg-green-200 rounded-full animate-bounce delay-75"></span>
                            <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-bounce delay-150"></span>
                            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-bounce delay-300"></span>
                          </div>
                        </div>
                      )}
                      
                      {liveStatus === 'speaking' && liveMessages.length > 0 && liveMessages[liveMessages.length - 1].role === 'user' && (
                        <div className="flex justify-start pl-4">
                           <div className="text-[10px] font-black text-green-600 uppercase tracking-widest animate-pulse flex items-center gap-2">
                             <Volume2 className="w-3 h-3" />
                             Voice Forge responding...
                           </div>
                        </div>
                      )}
                      <div ref={liveMessagesEndRef} />
                    </>
                  )}
                </div>

                <div className="shrink-0 flex gap-4">
                  {isLiveActive ? (
                    <button
                      onClick={stopLiveSession}
                      className="flex-1 py-6 rounded-[2.5rem] bg-red-50 text-red-600 font-black tracking-widest border-2 border-red-100 hover:bg-red-100 transition-all flex items-center justify-center gap-3"
                    >
                      <Square className="w-5 h-5 fill-current" />
                      END PRERNA SESSION
                    </button>
                  ) : (
                    <button
                      onClick={startLiveSession}
                      disabled={liveStatus === 'connecting'}
                      className="flex-1 py-6 rounded-[2.5rem] bg-green-700 text-white font-black tracking-widest shadow-2xl shadow-green-900/20 hover:bg-green-800 transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                      {liveStatus === 'connecting' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                      {liveStatus === 'connecting' ? 'INITIATING FAST SYNC...' : 'START PRERNA CHAT'}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                    {activeTab === 'tts' ? <BookOpen className="w-6 h-6 text-green-700" /> : <Mic2 className="w-6 h-6 text-green-700" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">{activeTab === 'tts' ? 'Voice Forge' : 'Identity Swap'}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activeTab === 'tts' ? 'Convert text to ancient wisdom' : 'Swap your identity with a master'}</p>
                  </div>
                </div>

                {activeTab === 'tts' ? (
                  <textarea
                    className="w-full h-48 p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-200 outline-none transition-all resize-none text-slate-700 leading-relaxed placeholder:text-slate-300 font-medium text-lg"
                    placeholder="Type the wisdom here..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className={`relative flex flex-col items-center justify-center p-10 rounded-[2.5rem] border-4 border-dashed transition-all group ${isRecording ? 'border-red-500 bg-red-50' : recordedBlob ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-slate-50'}`}>
                      {isRecording ? (
                        <button onClick={stopRecording} className="w-20 h-20 bg-red-600 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-red-700"><Square className="w-8 h-8 fill-current" /></button>
                      ) : (
                        <button onClick={startRecording} className="w-20 h-20 bg-green-700 text-white rounded-full flex items-center justify-center shadow-xl hover:bg-green-800"><Mic className="w-8 h-8" /></button>
                      )}
                      <p className={`text-sm font-black tracking-widest mt-4 ${isRecording ? 'text-red-600 animate-pulse' : 'text-slate-500'}`}>{isRecording ? 'RECORDING...' : 'RECORD VOICE'}</p>
                    </div>
                    <label className="flex flex-col items-center justify-center p-10 rounded-[2.5rem] bg-slate-50 border-4 border-dashed border-slate-100 hover:border-green-200 cursor-pointer transition-all">
                      <Upload className="w-12 h-12 text-slate-300 mb-4" />
                      <p className="text-sm font-black text-slate-500 tracking-widest uppercase">Upload Audio</p>
                      <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
                    </label>
                  </div>
                )}

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Fine-tune Tone</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.values(SpeakingStyle).map((s) => (
                      <button key={s} onClick={() => setStyle(s)} className={`py-3 px-4 rounded-2xl text-[10px] font-black transition-all border-2 ${style === s ? 'bg-green-700 text-white border-green-700' : 'bg-white text-slate-400 border-slate-100 hover:border-green-200'}`}>{s}</button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleProcess}
                  disabled={isGenerating || (activeTab === 'tts' ? !text.trim() : !recordedBlob)}
                  className={`w-full flex items-center justify-center gap-4 py-6 rounded-[2.5rem] font-black text-lg transition-all active:scale-[0.98] ${isGenerating ? 'bg-slate-100 text-slate-300' : 'bg-green-700 text-white hover:bg-green-800'}`}
                >
                  {isGenerating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Zap className="w-6 h-6 fill-current" />}
                  {isGenerating ? 'FORGING...' : 'GENERATE SPEECH'}
                </button>
              </>
            )}
            
            {error && <div className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-bold flex items-center gap-3"><Info className="w-4 h-4" />{error}</div>}
          </section>
        </div>

        {/* Vault Panel */}
        <div className="lg:col-span-4">
          <section className="bg-white rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col h-[850px] sticky top-32 overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <h2 className="text-xl font-black flex items-center gap-3 text-slate-800"><History className="w-6 h-6 text-slate-400" />Vault</h2>
              <div className="bg-white px-3 py-1 rounded-full border border-slate-100 text-[10px] font-black text-slate-400">{history.length}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-40 opacity-30 grayscale"><Clock className="w-16 h-16 mb-6" /><p className="text-[10px] font-black uppercase">Empty Vault</p></div>
              ) : (
                history.map((item) => {
                  const voiceMeta = VOICE_GALLERY.find(v => v.id === item.voice);
                  return (
                    <div key={item.id} className="p-5 bg-white border border-slate-100 rounded-[2rem] hover:border-green-300 transition-all group overflow-hidden">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[9px] font-black uppercase bg-green-700 text-white px-2 py-0.5 rounded-lg shadow-sm">{voiceMeta?.displayName}</span>
                        <button onClick={() => setHistory(prev => prev.filter(h => h.id !== item.id))} className="text-slate-200 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-2 mb-5 italic">"{item.text}"</p>
                      <div className="flex items-center gap-2">
                        <button onClick={() => playAudio(item)} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black transition-all ${activeAudioId === item.id ? 'bg-green-700 text-white' : 'bg-slate-50 hover:bg-green-50'}`}>
                          {activeAudioId === item.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                          LISTEN
                        </button>
                        <button onClick={() => downloadAudio(item)} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-slate-400 hover:text-green-700"><Download className="w-5 h-5" /></button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="py-16 bg-white border-t border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col items-center gap-8 opacity-30">
          <div className="flex gap-10 text-xs font-black uppercase tracking-[0.4em]">{['Ayurveda', 'Yoga', 'Unani', 'Siddha', 'Homoeopathy'].map(s => <span key={s}>{s}</span>)}</div>
          <p className="text-[10px] font-black uppercase tracking-widest">AYUSH AI Forge v2.1</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
