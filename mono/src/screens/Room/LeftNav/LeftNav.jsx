import styled from 'styled-components';

const LeftNav = () => {
  return (
    <>
      <Container>
        <Logo>VI.mate</Logo>
      </Container>
    </>
  );
};
export default LeftNav;

const Container = styled.div`
  height: 100%;
  width: 100%;
  max-width: 360px;
  border-radius: 19px;
  box-shadow: 0px 2px 6px rgba(0,0,0,0.3);
`;

// const Nav = styled.nav`
//   display: flex;
//   flex-direction: column;
//   align-items: center;
//   gap: 50px;
//   height: 60%;
//   margin-top: 50px;
// `;
// const NavItem = styled.div`
//   font-weight: bold;
//   font-size: ${(props) => (props.active ? '1.4rem' : '1.1rem')};
//   letter-spacing: 1px;
//   cursor: pointer;
//   color: ${(props) => (props.active ? 'red' : 'black')};
// `;

const Logo = styled.div`
  font-weight: bold;
  height: 32px;
  margin-top: 16px;
  display: grid;
  place-items: center;
  filter: drop-shadow(0px 0px 1px #3535355f);
  font-size: 24pt;
  background: linear-gradient(0.25turn, #ff076a77 10%, #044efb);
  background-clip: text;
  -webkit-text-fill-color: transparent;
`;
