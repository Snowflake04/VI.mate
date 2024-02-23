import styled from 'styled-components';

const Navbar = () => {
  return (
    <Container>
      <Logo>MONO</Logo>
    </Container>
  );
};

export default Navbar;

const Container = styled.div`
  height: 64px;
  display: flex;
  width: 100%;
  justify-content: space-between;
  padding: 30px 6%;
`;

const Logo = styled.div`
  font-weight: bold;
  height: 32px;
  filter:drop-shadow(5 0 3px rgba(237, 241, 241, 0.4));
  display: grid;
  place-items: center;
  font-size: 1.8rem;
  background: linear-gradient(0.25turn, #e66465, #4b52a4);
  background-clip: text;
  -webkit-text-fill-color: transparent;
`;
