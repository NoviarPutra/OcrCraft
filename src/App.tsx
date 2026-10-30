import { useState } from 'react'
import { DemoHub } from './components/hub/DemoHub'
import { ByokVisionWorkspace } from './components/workspace/byok/ByokVisionWorkspace'
import { PaddleOcrWorkspace } from './components/workspace/paddle/PaddleOcrWorkspace'
import { RapidOcrWorkspace } from './components/workspace/rapid/RapidOcrWorkspace'
import { TesseractWorkspace } from './components/workspace/TesseractWorkspace'

export type AppView = 'hub' | 'workspace'

export function App() {
  const [currentView, setCurrentView] = useState<AppView>('hub')
  const [selectedDemoId, setSelectedDemoId] = useState<string>('client-side-tesseract')

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
      ) : selectedDemoId === 'byok-vision-ocr' ? (
        <ByokVisionWorkspace onBackToHub={handleBackToHub} />
      ) : selectedDemoId === 'paddleocr-onnx' ? (
        <PaddleOcrWorkspace onBackToHub={handleBackToHub} />
      ) : selectedDemoId === 'rapidocr-fastapi' ? (
        <RapidOcrWorkspace onBackToHub={handleBackToHub} />
      ) : (
        <TesseractWorkspace onBackToHub={handleBackToHub} />
      )}
    </div>
  )
}
export default App
