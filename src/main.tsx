import { StrictMode } from 'react'; // 开启 React 的严格模式，用于开发时帮助检测潜在问题
import { createRoot } from 'react-dom/client'; // 从 react-dom 引入 createRoot，用于创建 React 应用的根节点
import App from './App.tsx'; // 引入主应用组件
import './index.css'; // 引入全局样式（TailwindCSS）

// 将 React 应用挂载到 HTML 页面中的 id 为 'root' 的元素上
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App /> {/* 渲染主组件 App */}
  </StrictMode>
);
