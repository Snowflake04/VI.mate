import styled from 'styled-components';
import local from '../../../dummyDatas/local.png';
import remote from '../../../dummyDatas/remote.png';
import ReactPlayer from 'react-player';


const VideoScreen = ({localStream, remoteStream}) => {
  return (
    <Container>
      <LocalStream>
        <ReactPlayer   
          url={localStream}
          playing={true}
          width={'100%'}
          />
      </LocalStream>
      <RemoteStream>
        <RemoteStreamContainer>
          <img src={remote} alt='' />
        </RemoteStreamContainer>
        <RemoteStreamContainer>
          <img src={remote} alt='' />
        </RemoteStreamContainer>
        <RemoteStreamContainer>
          <img src={remote} alt='' />
        </RemoteStreamContainer>
        <RemoteStreamContainer>
          <img src={remote} alt='' />
        </RemoteStreamContainer>
      </RemoteStream>
    </Container>
  );
};

export default VideoScreen;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: 15px;
  margin: 5px 10px;
  margin-top: 0;
  position: relative;
  justify-content: space-between;
  align-content: space-between;
`;
const LocalStream = styled.div`
  height: 0;
  padding-bottom: 56.25%;
  border-radius: 15px;
  margin-bottom: 5px;
  max-height: 55%;
  overflow: hidden;
  img {
    width: 100%;
    border-radius: 15px;
  }
`;

const RemoteStream = styled.div`
  border-radius: 15px;
  margin-top: 5px;
  display: grid;
  gap: 12px;
  overflow: hidden;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  img {
    width: 100%;
  }
`;

const RemoteStreamContainer = styled.div`
  border-radius: 15px;
  overflow:hidden;

  
  img{
    height:100%;
  }

  &:nth-child(4){
    filter: blur(1px)
  }
`;
