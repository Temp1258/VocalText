import React, { useState, useRef, useEffect } from 'react';   //添加useState, useRef, useEffect
import { Mic, MicOff, FileText, Settings, AlertCircle, Download, X, Globe2, Archive } from 'lucide-react';    //添加图标

type RecordingStatus = 'idle' | 'recording' | 'transcribing' | 'complete' | 'error';    //添加RecordingStatus类型
type Language = 'en-US' | 'zh-CN';    //添加Language类型

interface ErrorState {    //添加ErrorState接口
  message: string;
  details?: string;
}

interface LanguageOption {    //添加LanguageOption接口
  code: Language;
  label: string;
  nativeName: string;
}

interface StoredTranscript {    //添加StoredTranscript接口
  id: string;
  text: string;
  language: Language;
  timestamp: number;
}

const languageOptions: LanguageOption[] = [   //添加languageOptions
  { code: 'en-US', label: 'English', nativeName: 'English' },
  { code: 'zh-CN', label: 'Chinese', nativeName: '中文' },
];

// Define SpeechRecognition for TypeScript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;   //添加SpeechRecognition
const recognition = new SpeechRecognition();    //添加recognition
recognition.continuous = true;  //添加recognition.continuous
recognition.interimResults = true;  //添加recognition.interimResults

const STORAGE_KEY = 'voice_to_doc_transcripts';   //添加STORAGE_KEY
const ONE_DAY_MS = 24 * 60 * 60 * 1000;  //添加ONE_DAY_MS

function App() {  //添加App函数
  const [status, setStatus] = useState<RecordingStatus>('idle');  //添加status
  const [transcript, setTranscript] = useState<string>('');   //添加transcript
  const [error, setError] = useState<ErrorState | null>(null);  //添加error
  const [interimTranscript, setInterimTranscript] = useState<string>(''); //添加interimTranscript
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en-US');  //添加selectedLanguage
  const [showStorage, setShowStorage] = useState(false);  //添加showStorage
  const [storedTranscripts, setStoredTranscripts] = useState<StoredTranscript[]>([]); //添加storedTranscripts
  
  const recognitionRef = useRef<typeof recognition | null>(null); //添加recognitionRef

  // recognitionRef是一个useRef钩子，它存储了recognition对象的引用。这样我们就可以在组件的生命周期内访问recognition对象，而不需要在每次渲染时重新创建它。
  // useEffect钩子用于在组件挂载时加载和清理存储的转录文本。我们首先从localStorage中加载存储的转录文本，然后过滤掉超过一天的转录文本。
  // 如果有任何过期的转录文本，我们将更新localStorage并更新组件的状态。
  // 最后，我们设置一个定时器，每小时清理一次过期的转录文本。
  // useEffect钩子的返回函数用于清理定时器，以避免内存泄漏。

  // Load and clean stored transcripts on mount
  // useeffect钩子用于在组件挂载时加载和清理存储的转录文本
  useEffect(() => {  //添加useEffect
    const loadAndCleanTranscripts = () => {   //添加loadAndCleanTranscripts函数
      const stored = localStorage.getItem(STORAGE_KEY);  //添加stored
      if (stored) { 
        const transcripts: StoredTranscript[] = JSON.parse(stored);
        const now = Date.now();
        const validTranscripts = transcripts.filter(t => (now - t.timestamp) < ONE_DAY_MS);
        
        // Update localStorage if any transcripts were removed
        if (validTranscripts.length !== transcripts.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validTranscripts));
        }
        
        setStoredTranscripts(validTranscripts);
      }
    };

    // Load and clean stored transcripts on mount
    loadAndCleanTranscripts();
    // Clean expired transcripts every hour
    const interval = setInterval(loadAndCleanTranscripts, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!SpeechRecognition) {
      setError({
        message: 'Speech Recognition Not Supported',
        details: 'Your browser does not support speech recognition. Please try using Chrome, Edge, or Safari.'
      });
      return;
    }

    recognition.lang = selectedLanguage;

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      setTranscript(final);
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setError({
        message: 'Recognition Error',
        details: `Error: ${event.error}. Please try again.`
      });
      setStatus('error');
      recognition.stop();
    };

    recognition.onend = () => {
      if (status === 'recording') {
        recognition.start();
      } else if (status !== 'error') {
        setStatus('complete');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [status, selectedLanguage]);
  
  const handleStartRecording = async () => {
    try {
      setTranscript('');
      setInterimTranscript('');
      setError(null);
      setStatus('recording');
      recognition.start();
    } catch (err) {
      console.error('Error starting recognition:', err);
      setError({
        message: 'Recognition Start Error',
        details: 'Failed to start speech recognition. Please try again.'
      });
      setStatus('error');
    }
  };

  const handleStopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setStatus('complete');
      
      // Store the transcript
      if (transcript.trim()) {
        const newTranscript: StoredTranscript = {
          id: Date.now().toString(),
          text: transcript,
          language: selectedLanguage,
          timestamp: Date.now(),
        };
        
        const updatedTranscripts = [...storedTranscripts, newTranscript];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTranscripts));
        setStoredTranscripts(updatedTranscripts);
      }
    }
  };

  const handleDownload = (text: string, lang: Language) => {
    const fileBlob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(fileBlob);
    const link = document.createElement('a');
    const langCode = lang === 'zh-CN' ? 'cn' : 'en';
    link.href = url;
    link.download = `transcript-${langCode}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDismissError = () => {
    setError(null);
    setStatus('idle');
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLanguage(e.target.value as Language);
    if (status === 'recording') {
      handleStopRecording();
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const getTimeRemaining = (timestamp: number) => {
    const remaining = ONE_DAY_MS - (Date.now() - timestamp);
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <FileText className="h-6 w-6 text-indigo-600" />
            <h1 className="text-xl font-semibold text-gray-900">Voice-to-Doc</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Globe2 className="h-5 w-5 text-gray-600" />
              <select
                value={selectedLanguage}
                onChange={handleLanguageChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                disabled={status === 'recording'}
              >
                {languageOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label} ({option.nativeName})
                  </option>
                ))}
              </select>
            </div>
            <button 
              onClick={() => setShowStorage(!showStorage)}
              className="p-2 rounded-full hover:bg-gray-100 relative"
            >
              <Archive className="h-5 w-5 text-gray-600" />
              {storedTranscripts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {storedTranscripts.length}
                </span>
              )}
            </button>
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Settings className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {showStorage && storedTranscripts.length > 0 && (
          <div className="mb-8 bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Stored Transcripts</h2>
              <button
                onClick={() => setShowStorage(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              {storedTranscripts.map((stored) => (
                <div key={stored.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {formatTimestamp(stored.timestamp)}
                      </span>
                      <span className="ml-2 text-sm text-gray-500">
                        ({stored.language === 'zh-CN' ? '中文' : 'English'})
                      </span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500">
                        Expires in: {getTimeRemaining(stored.timestamp)}
                      </span>
                      <button
                        onClick={() => handleDownload(stored.text, stored.language)}
                        className="flex items-center space-x-1 text-indigo-600 hover:text-indigo-700"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-700 line-clamp-2">{stored.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center justify-center space-y-8">
            {/* Error Display */}
            {error && (
              <div className="w-full max-w-md bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-red-800">{error.message}</h3>
                    <p className="mt-1 text-sm text-red-700">{error.details}</p>
                  </div>
                  <button
                    onClick={handleDismissError}
                    className="ml-4 text-red-400 hover:text-red-500"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}

            {/* Recording Status Circle */}
            <div className="relative">
              <div className={`
                w-48 h-48 rounded-full flex items-center justify-center
                ${status === 'idle' ? 'bg-gray-100' : ''}
                ${status === 'recording' ? 'bg-red-50 animate-pulse' : ''}
                ${status === 'complete' ? 'bg-green-50' : ''}
                ${status === 'error' ? 'bg-red-50' : ''}
              `}>
                <button
                  onClick={status === 'recording' ? handleStopRecording : handleStartRecording}
                  className={`
                    w-32 h-32 rounded-full flex items-center justify-center
                    transition-all duration-200 ease-in-out
                    ${status === 'recording' 
                      ? 'bg-red-600 hover:bg-red-700' 
                      : 'bg-indigo-600 hover:bg-indigo-700'}
                    ${status === 'error' ? 'bg-red-600' : ''}
                  `}
                >
                  {status === 'recording' ? (
                    <MicOff className="h-12 w-12 text-white" />
                  ) : (
                    <Mic className="h-12 w-12 text-white" />
                  )}
                </button>
              </div>
              
              {/* Status Text */}
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-500">
                  {status === 'idle' && 'Click to start recording'}
                  {status === 'recording' && 'Recording in progress...'}
                  {status === 'complete' && 'Recording complete!'}
                  {status === 'error' && 'Recording failed'}
                </span>
              </div>
            </div>

            {/* Live Transcript Display */}
            {status === 'recording' && (
              <div className="w-full max-w-2xl mt-8">
                <div className="bg-gray-50 rounded-lg p-6">
                  <p className="text-gray-700 whitespace-pre-wrap">
                    {transcript}
                    <span className="text-gray-400">{interimTranscript}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Final Transcript Display */}
            {status === 'complete' && transcript && (
              <div className="w-full max-w-2xl mt-12">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Transcript</h2>
                  <button
                    onClick={() => handleDownload(transcript, selectedLanguage)}
                    className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    <span>Download</span>
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-6">
                  <p className="text-gray-700 whitespace-pre-wrap">{transcript}</p>
                </div>
              </div>
            )}

            {/* Info Box */}
            {status === 'idle' && (
              <div className="mt-12 bg-blue-50 rounded-lg p-4 max-w-md w-full">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">How it works</h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>1. Select your preferred language (English or Chinese)</p>
                      <p>2. Click the microphone button to start recording</p>
                      <p>3. Click again to stop when you're finished</p>
                      <p>4. Your speech will be converted to text in real-time</p>
                      <p>5. Download your transcript when complete</p>
                      <p>6. Access stored transcripts using the archive button</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;