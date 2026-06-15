import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TagColorProvider } from './context/TagColorProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TagColorProvider>
      <App />
    </TagColorProvider>
  </StrictMode>,
)
