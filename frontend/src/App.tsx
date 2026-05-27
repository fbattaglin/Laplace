import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import DataInput from './pages/DataInput';
import Diagnostics from './pages/Diagnostics';
import Validation from './pages/Validation';
import Forecast from './pages/Forecast';
import Export from './pages/Export';
import RunComparison from './pages/RunComparison';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/input" replace />} />
          <Route path="input" element={<DataInput />} />
          <Route path="diagnostics" element={<Diagnostics />} />
          <Route path="validation" element={<Validation />} />
          <Route path="forecast" element={<Forecast />} />
          <Route path="export" element={<Export />} />
          <Route path="runs" element={<RunComparison />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
