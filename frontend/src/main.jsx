import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PageErrorBoundary from './components/PageErrorBoundary.jsx'
import './index.css'
import './design-system.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PageErrorBoundary><App /></PageErrorBoundary>
  </React.StrictMode>,
)
