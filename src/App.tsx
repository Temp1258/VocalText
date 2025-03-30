//添加useState创建和更新状态, useRef创建组件内不变的引用, useEffect副作用钩子，处理生命周期逻辑
import React, { useState, useRef, useEffect } from 'react';   
//'lucide-react'提供页面上用的各种图标（如麦克风）
import { Mic, MicOff, FileText, Settings, AlertCircle, Download, X, Globe2, Archive } from 'lucide-react'; 


// 这些是 TypeScript 提供的类型安全机制，帮助在写代码时避免出错。
type RecordingStatus = 'idle' | 'recording' | 'transcribing' | 'complete' | 'error';    //添加RecordingStatus类型
type Language = 'en-US' | 'zh-CN';    //添加Language类型

// 定义错误信息的结构
interface ErrorState { 
  message: string;
  details?: string;
}

// 定义语言选项的结构
interface LanguageOption {
  code: Language;
  label: string;
  nativeName: string;
}

// 定义已保存转录内容的结构
interface StoredTranscript {  
  id: string;
  text: string;
  language: Language;
  timestamp: number;
}

// 支持的语言选项列表
const languageOptions: LanguageOption[] = [ 
  { code: 'en-US', label: 'English', nativeName: 'English' },
  { code: 'zh-CN', label: 'Chinese', nativeName: '中文' },
];




// 初始化浏览器的语音识别功能
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition(); 

// 持续监听语音
recognition.continuous = true; 
// 实时返回中间结果
recognition.interimResults = true; 

// 本地存储 key
const STORAGE_KEY = 'voice_to_doc_transcripts';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;  // 一天的毫秒数




function App() {  //添加App函数
  const [status, setStatus] = useState<RecordingStatus>('idle');  //管理录音状态
  const [transcript, setTranscript] = useState<string>('');   //保存最终转录结果
  const [error, setError] = useState<ErrorState | null>(null);  //错误信息
  const [interimTranscript, setInterimTranscript] = useState<string>(''); //实时显示的文字
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en-US');  //用户选的语言
  const [showStorage, setShowStorage] = useState(false);  //是否显示存档
  const [storedTranscripts, setStoredTranscripts] = useState<StoredTranscript[]>([]); //历史转录记录

  // 用 ref 来保存 recognition 对象的引用，避免多次创建
  const recognitionRef = useRef<typeof recognition | null>(null); //添加recognitionRef

  // 页面挂载时：加载历史转录记录 + 每小时清除过期记录
  useEffect(() => {  
    const loadAndCleanTranscripts = () => {
      const stored = localStorage.getItem(STORAGE_KEY); 
      if (stored) {
        const transcripts: StoredTranscript[] = JSON.parse(stored);
        const now = Date.now();
        const validTranscripts = transcripts.filter(t => (now - t.timestamp) < ONE_DAY_MS);

        // 如果有记录被清除，更新本地存储        
        if (validTranscripts.length !== transcripts.length) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(validTranscripts));
        }
        
        setStoredTranscripts(validTranscripts);
      }
    };

    // 初始加载
    loadAndCleanTranscripts();
    // 每小时清理过期记录
    const interval = setInterval(loadAndCleanTranscripts, 60 * 60 * 1000);
    
    // 卸载时清除定时器
    return () => clearInterval(interval);
  }, []);


  // 当状态或语言发生变化时：配置 recognition 的行为

  // 第一类触发error的情况：如果当前浏览器不支持 SpeechRecognition API，会直接提示错误
  useEffect(() => {
    if (!SpeechRecognition) {
      setError({
        message: 'Speech Recognition Not Supported',
        details: 'Your browser does not support speech recognition. Please try using Chrome, Edge, or Safari.'
      });
      return;
    }
    
    // 设置语音识别语言
    recognition.lang = selectedLanguage; 

    recognition.onresult = (event) => {
      let interim = ''; //初始实时文本
      let final = ''; //初始最终文本

      // 遍历识别结果
      // event.results 是一个包含所有识别结果的列表      
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {  // event.results[i].isFinal 是一个布尔值，表示结果是否是最终结果
          final += event.results[i][0].transcript + ' ';  // event.results[i][0].transcript 是识别的文本
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      
      // 设置最终文本
      setTranscript(final);
      // 设置实时文本      
      setInterimTranscript(interim);
    };

  // 第二类触发error的情况：语音识别中出错（例如用户拒绝使用麦克风权限，网络错误，未检测到语音，找不到麦克风设备）
    recognition.onerror = (event) => { // 识别错误
      console.error('Speech recognition error:', event.error); //打印错误信息
      setError({
        message: 'Recognition Error',
        details: `Error: ${event.error}. Please try again.`
      });
      setStatus('error');
      recognition.stop(); //停止识别
    };


    recognition.onend = () => {  // 识别结束
      if (status === 'recording') {
        // 自动重启录音
        recognition.start(); 
      } else if (status !== 'error') {  // 如果不是错误状态
        // 设置状态为完成
        setStatus('complete');
      }
    };

    // 保存到 ref 中
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();  // 状态切换时停止录音
    };
  }, [status, selectedLanguage]);
  
  // 开始录音
  const handleStartRecording = async () => {
    try {
      setTranscript('');  //清空转录文本
      setInterimTranscript(''); //清空实时文本
      setError(null); //清空错误信息
      setStatus('recording'); //设置状态为录音中
      recognition.start(); //开始录音
    } catch (err) { //捕获错误
      console.error('Error starting recognition:', err); // 打印错误信息
      setError({
        message: 'Recognition Start Error',
        details: 'Failed to start speech recognition. Please try again.'
      });
      setStatus('error');
    }
  };

  // 停止录音，并保存结果
  const handleStopRecording = () => {
    if (recognitionRef.current) { // 判断是否有识别对象，如果有则停止录音并设置状态为完成
      recognitionRef.current.stop();
      setStatus('complete');
      
      // 如果有转录文本则保存到 localStorage
      if (transcript.trim()) { // 判断转录文本是否为空
        const newTranscript: StoredTranscript = {
          id: Date.now().toString(), // 使用当前时间戳作为唯一 ID
          text: transcript, // 转录文本
          language: selectedLanguage, // 语言
          timestamp: Date.now(), // 当前时间戳
        };
        
        const updatedTranscripts = [...storedTranscripts, newTranscript]; // 更新转录记录
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTranscripts)); // 保存到 localStorage并更新状态
        setStoredTranscripts(updatedTranscripts);
      }
    }
  };

  // 下载转录文件为 txt
  const handleDownload = (text: string, lang: Language) => {
    const fileBlob = new Blob([text], { type: 'text/plain' }); //创建 Blob 对象
    const url = URL.createObjectURL(fileBlob); //创建 URL 对象
    const link = document.createElement('a'); //创建下载链接
    const langCode = lang === 'zh-CN' ? 'cn' : 'en'; //设置语言代码
    link.href = url; //设置链接地址
    link.download = `transcript-${langCode}-${new Date().toISOString().split('T')[0]}.txt`; //设置下载文件名
    document.body.appendChild(link); // 将链接添加到文档中
    link.click(); // 模拟点击下载
    document.body.removeChild(link); // 移除链接
    URL.revokeObjectURL(url); // 释放 URL 对象
  };

  // 错误提示关闭按钮
  const handleDismissError = () => {
    setError(null); // 清空错误信息
    setStatus('idle'); // 设置状态为空闲
  };

  // 语言选择处理函数
  // 当用户选择语言时，更新状态并停止录音
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLanguage(e.target.value as Language);
    if (status === 'recording') {   // 如果当前状态是录音中，则停止录音
      handleStopRecording();
    }
  };

  // 格式化时间戳为可读时间
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp); // 创建日期对象
    return date.toLocaleString(); // 格式化为本地时间字符串
  };

  // 计算转录文本还剩多久过期
  const getTimeRemaining = (timestamp: number) => {
    const remaining = ONE_DAY_MS - (Date.now() - timestamp);
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m`;
  };

  // 返回整个页面结构（JSX）
  return (
    // 页面最外层容器，背景使用渐变色
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">

      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">

          {/* 左边：Logo 和标题 */}
          <div className="flex items-center space-x-2">
            <FileText className="h-6 w-6 text-indigo-600" />
            <h1 className="text-xl font-semibold text-gray-900">Voice-to-Doc</h1>
          </div>

          {/* 右边：语言选择、历史按钮、设置按钮 */}
          <div className="flex items-center space-x-4">

            {/* 语言选择器 */}
            <div className="flex items-center space-x-2">
              <Globe2 className="h-5 w-5 text-gray-600" />
              <select
                value={selectedLanguage}
                onChange={handleLanguageChange}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                disabled={status === 'recording'} // 录音中禁止切换语言
              >
                {languageOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label} ({option.nativeName})
                  </option>
                ))}
              </select>
            </div>

            {/* 显示历史转录记录按钮 + 气泡提示数量 */}
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

            {/* 语音识别设置按钮（当前无功能） */}
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Settings className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* 页面主体部分 */}
      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* 展示历史转录记录存档 */}
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

         {/* 主功能区卡片容器 */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center justify-center space-y-8">
            {/* 错误提示框 */}
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

            {/* 录音按钮区域（状态颜色和动画根据状态切换） */}
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
                > {/* 麦克风按钮图标根据状态切换 */}
                  {status === 'recording' ? (
                    <MicOff className="h-12 w-12 text-white" />
                  ) : (
                    <Mic className="h-12 w-12 text-white" />
                  )}
                </button>
              </div>
              
              {/* 状态文本提示 */}
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                <span className="text-sm font-medium text-gray-500">
                  {status === 'idle' && 'Click to start recording'}
                  {status === 'recording' && 'Recording in progress...'}
                  {status === 'complete' && 'Recording complete!'}
                  {status === 'error' && 'Recording failed'}
                </span>
              </div>
            </div>

            {/* 实时转录展示区 */}
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

            {/* 最终转录结果展示 + 下载 */}
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

            {/* 信息提示区域（默认状态展示） */}
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

export default App; // 导出App组件 使其可以在其他文件中使用