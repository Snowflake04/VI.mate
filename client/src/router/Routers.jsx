import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LobbyScreen from '../screens/Lobby';
import RoomPage from '../screens/Room';

const Routers = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/' element={<LobbyScreen />} />
        <Route path='/room/:roomId' element={<RoomPage />} />
      </Routes>
    </BrowserRouter>
  );
};
export default Routers;
