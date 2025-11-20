import './App.css';
import AppRoutes from './routes/AppRoutes';
import { HashRouter } from 'react-router-dom';


function App() {
  return (
      <HashRouter>
       <AppRoutes/>
      </HashRouter>
  );
}

export default App;
