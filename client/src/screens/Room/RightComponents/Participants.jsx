import styled from 'styled-components';
import Participant from './Participant';

const Participants = () => {
  return (
    <Container>
      <Header>
        Participants
        <Counter>10</Counter>
      </Header>
      <ParticipantsHolder>
        <Participant />
        <Participant />
        <Participant />
        <Participant />
        <Participant />
        <Participant />
        <Participant />
        <Participant />
        <Participant />
        <Participant />
        <Participant />
        <Participant />
        <Participant />
        <Participant />
        <Participant />
      </ParticipantsHolder>
    </Container>
  );
};

export default Participants;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 15px;
  margin-bottom: 5px;
  overflow:hidden;
`;

const Header = styled.div`
  height: 20%;
  display: flex;
  align-items: center;
  padding: 15px;
  max-width: 100%;
  font-size: 1.4rem;
  position: relative;

  &::after {
    content: '';
    background: #c0bebe;
    height: 2px;
    width: 80%;
    position: absolute;
    bottom: 0;
  }
`;

const Counter = styled.div`
  border: 1px solid #dfdede;
  border-radius: 50%;
  display: grid;
  padding: 0 5px;
  place-items: center;
  font-size: 1rem;
  margin-left:12px;
`;

const ParticipantsHolder = styled.div`
  margin-top: 15px;
  display:grid;
  gap: 8px;
  overflow-y:scroll;
  &::-webkit-scrollbar {
    display:none;
  }
`;


