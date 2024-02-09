import styled from 'styled-components';
import LeftNav from './LeftNav/LeftNav';
import MiddleContent from './MiddleContent';
import RightComponent from './RightComponents';

const Splash = () => {
  return (
    <MainContainer>
      <LeftNav />
      <MiddleContent />
      <RightComponent/>
    </MainContainer>
  );
};

export default Splash;

const MainContainer = styled.div`

  display: grid;
  grid-template-columns: 1.2fr 4fr 1.5fr;
  height: 100vh;
  background-color: #e0dfdf;
  padding: 12px;

`;
