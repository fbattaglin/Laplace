import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { DataInputScreen } from './components/data-input/DataInputScreen'
import { DiagnosticsScreen } from './components/diagnostics/DiagnosticsScreen'
import { ValidationScreen } from './components/validation/ValidationScreen'
import { ForecastScreen } from './components/forecast/ForecastScreen'
import { ExportScreen } from './components/export/ExportScreen'
import { useAppStore } from './stores/useAppStore'

function StepContent() {
  const { currentStep } = useAppStore()

  return (
    <div key={currentStep} className="animate-fade-in">
      {currentStep === 'dataInput' && <DataInputScreen />}
      {currentStep === 'diagnostics' && <DiagnosticsScreen />}
      {currentStep === 'validation' && <ValidationScreen />}
      {currentStep === 'forecast' && <ForecastScreen />}
      {currentStep === 'export' && <ExportScreen />}
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AppShell>
        <StepContent />
      </AppShell>
    </ErrorBoundary>
  )
}

export default App
