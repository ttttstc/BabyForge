import { createRoot } from 'react-dom/client'
import { App } from './app/App.jsx'
import './styles.css'

// R3F GLTF canvases need a single mount: React StrictMode's development
// remount disposes the cached WebGL specimen before the second paint.
createRoot(document.getElementById('root')).render(<App />)
