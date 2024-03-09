import styled from 'styled-components';
import Participant from './Participant';
import { useStream } from '../../../context/StreamProvider';

const Participants = () => {
  const { userMap } = useStream();

  return (
    <Container>
      <Header>
        Participants
        <Counter>{Object.keys(userMap).length}</Counter>
      </Header>
      <ParticipantsHolder>
        {Object.entries(userMap).map(([key, value]) => (
          <Participant key={key} username={value} />
        ))}
      </ParticipantsHolder>
    </Container>
  );
};

export default Participants;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  background: linear-gradient( #eafafb,#ffffff);
  border-radius: 10px;
  margin-bottom: 5px;
  overflow: hidden;
`;

const Header = styled.div`
  height: 20%;
  display: flex;
  align-items: center;
  padding: 15px;
  max-width: 100%;
  font-size: 1.4rem;
  position: relative;
  box-shadow: 0px 2px 8px rgba(0,0,0,0.1)
`;

const Counter = styled.div`
  border: 1px solid #dfdede;
  border-radius: 50%;
  display: grid;
  padding: 0 5px;
  place-items: center;
  font-size: 1rem;
  margin-left: 12px;
`;

const ParticipantsHolder = styled.div`
  margin-top: 6px;
  display: grid;
  gap: 4px;
  overflow-y: scroll;
  &::-webkit-scrollbar {
    display: none;
  }
`;
