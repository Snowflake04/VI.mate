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
  border-radius: 19px;
  overflow:hidden;
`;