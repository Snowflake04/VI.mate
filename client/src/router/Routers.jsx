import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LobbyScreen from '../screens/Lobby';
import Splash from '../screens/Room/'

const Routers = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* <Route path='/' element={<LobbyScreen />} /> */}
        <Route path='/' element={<Splash />} />
        {/* <Route path='/room/:roomId' element={<RoomPage />} /> */}
      </Routes>
    </BrowserRouter>
  );
};
export default Routers;
