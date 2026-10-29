import { useState } from 'react'
import { DemoHub } from './components/hub/DemoHub'
import { TesseractWorkspace } from './components/workspace/TesseractWorkspace'

export type AppView = 'hub' | 'workspace'

export function App() {
  const [currentView, setCurrentView] = useState<AppView>('hub')
  const [_selectedDemoId, setSelectedDemoId] = useState<string>('client-side-tesseract')

  const handleSelectDemo = (demoId: string) => {
    setSelectedDemoId(demoId)
    setCurrentView('workspace')
  }

  const handleBackToHub = () => {
    setCurrentView('hub')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {currentView === 'hub' ? (
        <DemoHub onSelectDemo={handleSelectDemo} />
      ) : (
        <TesseractWorkspace onBackToHub={handleBackToHub} />
      )}
    </div>
  )
}
export default App
