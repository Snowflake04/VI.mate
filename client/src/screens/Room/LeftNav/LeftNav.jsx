import styled from 'styled-components';

const LeftNav = () => {
  return (
    <>
      <Container>
        <Name>Mono</Name>
        <Nav>
          <NavItem active>Homepage</NavItem>
          <NavItem>Schedule</NavItem>
          <NavItem>Teams</NavItem>
          <NavItem>Chats</NavItem>
          <NavItem>Settings</NavItem>
        </Nav>
      </Container>
    </>
  );
};
export default LeftNav;

const Container = styled.div`
  height: 100%;
  width:100%;
  background-color: white;
  max-width: 360px;
  border-radius: 19px;
`;
const Name = styled.div`
  font-weight: bold;
  height: 80px;
  display: grid;
  place-items: center;
  font-size: 2rem;
  background: linear-gradient(0.25turn, #e66465, #4b52a4);
  background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const Nav = styled.nav`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 50px;
  height: 60%;
  margin-top: 50px;
`;
const NavItem = styled.div`
  font-weight:bold;
  font-size:${props => props.active? "1.4rem" : "1.1rem"};
  letter-spacing:1px;
  cursor:pointer;
  color: ${props => props.active? "red" : "black"}
  
`;
