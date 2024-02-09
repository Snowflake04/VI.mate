import styled from 'styled-components';
import sampleChat from '../../../dummyDatas/Chat.json'

const Chats = () => {
  return (<Container>
    
    <Header>
        Chats
        <Counter>10</Counter>
      </Header>
      <ChatArea>

      </ChatArea>

      <TextArea>

      </TextArea>
    </Container>)
};

export default Chats;

const Container = styled.div`
  background: white;
  border-radius: 15px;
  margin-top: 5px;
  display:flex;
  flex-direction:column;
`;

const Header = styled.div`
  height: 12%;
  display: flex;
  align-items: center;
  padding: 15px;
  max-width: 100%;
  font-size: 1.4rem;
  position: relative;

  &::after {
    content: '';
    background: #e7e5e5;
    height: 1px;
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

const ChatArea = styled.div`
background-color: gray;
height:100%;
`

const TextArea = styled.div`
height:20%;
background-color: #c03b3b;
`