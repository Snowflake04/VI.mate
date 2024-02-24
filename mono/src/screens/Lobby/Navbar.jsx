import styled from 'styled-components';

const Navbar = () => {
  return (
    <Container>
      <Logo>VI.mate</Logo>
    </Container>
  );
};

export default Navbar;

const Container = styled.div`
  height: 64px;
  display: flex;
  width: 100%;
  justify-content: space-between;
  padding:32px 3%;
`;

const Logo = styled.div`
  font-weight: bold;
  height: 32px;
  filter:drop-shadow(0px 0px 1px #3535355f);
  font-size: 24pt;
  background: linear-gradient(0.25turn, #ff076a77 10% , #044efb);
  background-clip: text;
  -webkit-text-fill-color: transparent;
`;
