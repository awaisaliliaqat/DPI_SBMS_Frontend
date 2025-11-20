import './App.css';
import AppRoutes from './routes/AppRoutes';
import { BrowserRouter } from 'react-router-dom';
import { BASENAME } from './constants/Constants';


function App() {
  return (
      <BrowserRouter basename={BASENAME}>
       <AppRoutes/>
      </BrowserRouter>
  );
}

export default App;
