import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'   // 👈 this is where your big App lives
import './index.css'          // 👈 Tailwind styles

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
