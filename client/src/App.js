import Routers from './router/Routers';
import { SocketProvider } from "./context/SocketProvider";

function App() {
  return (
    <SocketProvider>
      <div className='App'>
        <Routers />
      </div>
    </SocketProvider>
  );
}

export default App;
