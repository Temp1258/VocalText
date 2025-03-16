import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, FileText, Settings, AlertCircle, Download, X, Globe2, Archive } from 'lucide-react';

type RecordingStatus = 'idle' | 'recording' | 'transcribing' | 'complete' | 'error';
type Language = 'en-US' | 'zh-CN';

interface ErrorState {
  message: string;
  details?: string;
}

interface LanguageOption {
  code: Language;
  label: string;
  nativeName: string;
}

interface StoredTranscript {
  id: string;
  text: string;
  language: Language;
  timestamp: number;
  wordCount: number;
}

const languageOptions: LanguageOption[] = [
  { code: 'en-US', label: 'English', nativeName: 'English' },
  { code: 'zh-CN', label: 'Chinese', nativeName: '中文' },
];

const STORAGE_KEY = 'voice_to_doc_transcripts';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_WORD_COUNT = 88888;
const MAX_RECORDING_HOURS = 6;

// Define SpeechRecognition for TypeScript
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.continuous = true;
recognition.interimResults = true;

function App() {
  const [status, setStatus] = useState<RecordingStatus>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<ErrorState | null>(null);
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en-US');
  const [showStorage, setShowStorage] = useState(false);
  const [storedTranscripts, setStoredTranscripts] = useState<StoredTranscript[]>([]);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  
  const recognitionRef = useRef<typeof recognition | null>(null);
  const transcriptRef = useRef<string>('');

  // Load and clean stored transcripts on mount
  useEffect(() => {
    const loadAndCleanTranscripts = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const transcripts: StoredTranscript[] = JSON.parse(stored);
        const now = Date.now();
        const validTranscripts = transcripts.filter(t => (now - t.timestamp) < ONE_DAY_MS);
        
        if (validTranscripts.length !== transcripts.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validTranscripts));
        }
        
        setStoredTranscripts(validTranscripts);
      }
    };

    loadAndCleanTranscripts();
    // Clean expired transcripts every hour
    const interval = setInterval(loadAndCleanTranscripts, 60 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Check recording duration
  useEffect(() => {
    let interval: number;
    if (status === 'recording' && recordingStartTime) {
      interval = setInterval(() => {
        const duration = Date.now() - recordingStartTime;
        const hours = duration / (1000 * 60 * 60);
        if (hours >= MAX_RECORDING_HOURS) {
          handleStopRecording();
          setError({
            message: 'Maximum Recording Duration Reached',
            details: `Recording stopped after ${MAX_RECORDING_HOURS} hours.`
          });
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, recordingStartTime]);

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
      let final = transcriptRef.current;

      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' ';
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      // Check word count
      const wordCount = final.trim().split(/\s+/).length;
      if (wordCount > MAX_WORD_COUNT) {
        handleStopRecording();
        setError({
          message: 'Maximum Word Count Reached',
          details: `Recording stopped after reaching ${MAX_WORD_COUNT} words.`
        });
        return;
      }

      transcriptRef.current = final;
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
      transcriptRef.current = '';
      setRecordingStartTime(Date.now());
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
      setRecordingStartTime(null);
      
      // Store the transcript
      if (transcript.trim()) {
        const wordCount = transcript.trim().split(/\s+/).length;
        const newTranscript: StoredTranscript = {
          id: Date.now().toString(),
          text: transcript,
          language: selectedLanguage,
          timestamp: Date.now(),
          wordCount,
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

  const getRecordingDuration = () => {
    if (!recordingStartTime) return '';
    const duration = Date.now() - recordingStartTime;
    const hours = Math.floor(duration / (1000 * 60 * 60));
    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((duration % (1000 * 60)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
                      <span className="ml-2 text-sm text-gray-500">
                        ({stored.wordCount.toLocaleString()} words)
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
                  {status === 'recording' && (
                    <>
                      Recording in progress... {getRecordingDuration()}
                      <br />
                      <span className="text-xs">
                        Words: {transcript.trim().split(/\s+/).length.toLocaleString()} / {MAX_WORD_COUNT.toLocaleString()}
                      </span>
                    </>
                  )}
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
                  <h2 className="text-lg font-semibold text-gray-900">
                    Transcript 
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({transcript.trim().split(/\s+/).length.toLocaleString()} words)
                    </span>
                  </h2>
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
                      <p>7. Maximum recording time: {MAX_RECORDING_HOURS} hours</p>
                      <p>8. Maximum words per transcript: {MAX_WORD_COUNT.toLocaleString()}</p>
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