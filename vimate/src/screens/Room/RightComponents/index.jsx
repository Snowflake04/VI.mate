import styled from 'styled-components';
import Chats from './Chats';
import Participants from './Participants';

const RightComponent = () => {
  return (
    <Container>
      <Participants />
      <Chats />
    </Container>
  );
};

export default RightComponent;

const Container = styled.div`
  height: 100%;
  display:grid;
  grid-template: 4fr 6fr/1fr;
  border-radius: 12px;
  overflow:hidden;
  filter: drop-shadow(0 0 5px  #d5d5d5);
`;
