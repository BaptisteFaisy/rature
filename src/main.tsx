import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import './styles.css'
import { Application } from './ui/App'
import { RatureProvider } from './etat/useRature'

const cible = document.getElementById('root')
if (!cible) throw new Error('Point de montage #root absent du document.')

createRoot(cible).render(
  <StrictMode>
    <RatureProvider>
      <Application />
    </RatureProvider>
  </StrictMode>,
)
