import styled, { keyframes } from 'styled-components';
import Navbar from './Navbar';
import MainScreen from './MainScreen';
const Lobby = () => {
  return (
    <>
      <Container>
        <Navbar />
        <MainScreen />
      </Container>
    </>
  );
};

export default Lobby;

const gradient = keyframes`
	0% {
		background-position: 0% 50%;
	}
	50% {
		background-position: 100% 50%;
	}
	100% {
		background-position: 0% 50%;
	}
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100dvh;
  width: 100dvw;
  background: linear-gradient(-45deg, #efd5cd, #8ad4eb, #c2f4ed, #8295c2);
  background-size: 400% 400%;
  animation: ${gradient} 15s ease infinite;
`;
