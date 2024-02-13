import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LobbyScreen from '../screens/Lobby';
import RoomPage from '../screens/Room/';
import { StreamProvider } from '../context/StreamProvider';

const Routers = () => {
  return (
    <StreamProvider>
      <BrowserRouter>
        <Routes>
          <Route path='/' element={<LobbyScreen />} />
          <Route path='/room/:roomId' element={<RoomPage />} />
        </Routes>
      </BrowserRouter>
    </StreamProvider>
  );
};
export default Routers;
