import './App.css';
import AppRoutes from './routes/AppRoutes';
import { HashRouter } from 'react-router-dom';
import { BASENAME } from './constants/Constants';


function App() {
  return (
      <HashRouter basename={BASENAME}>
       <AppRoutes/>
      </HashRouter>
  );
}

export default App;
