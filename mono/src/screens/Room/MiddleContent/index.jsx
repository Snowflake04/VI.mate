import styled from 'styled-components';
import VideoScreen from './VideoScreen';
import BottomNav from './BottomNav';
import { useState } from 'react';

const MiddleContent = () => {
  const [expandedLayout, setExpandedLayout] = useState(false);

  return (
    <Container>
      <VideoScreen layout ={expandedLayout}/>
      <BottomNav setLayout={setExpandedLayout} />
    </Container>
  );
};

export default MiddleContent;

const Container = styled.div`
  display: grid;
  grid-template: 8.5fr 1.2fr /1fr;
  border-radius: 15px;
  margin: 0 5px;
  overflow: hidden;
`;
