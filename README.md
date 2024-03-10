
<a name="readme-top"></a>

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <a href="https://github.com/snowflake04/VI.mate">
    <!-- <img src="images/logo.png" alt="Logo" width="80" height="80"> -->
  </a>

  <h3 align="center">VI.mate</h3>

  <p align="center">
    A Peer-to-Peer video conference App
    <br />
    <a href="https://github.com/othneildrew/Best-README-Template">View Demo</a>
    ·
    <a href="https://github.com/snowflake04/VI.mate/issues">Report Bug</a>
    ·
    <a href="https://github.com/snowflake04/VI.mate/issues">Request Feature</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#hosting">Hosting</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#support">Support</a></li>
  </ol>
</details>



<!-- ABOUT THE PROJECT -->
## About The Project

<!-- [![Product Name Screen Shot][product-screenshot]](https://example.com) -->

VI.mate is a Peer-Peer video conference application that allows multiple user video conferencing. It takes advantage of WebRTC technology inorder to provide a seemless and high quality video feed. The app also offers real time chat, screen sharing and Authorization management. Why you should use Vi.mate?

Here's why:
* It is a peer-Peer communication. This removes the need of Stacked server to relay Stream through. This reduces the need for huge server(server here is only used for signaling purposes).
* Since it is Peer-Peer, no data is stored in the server(except neccesary room details).
* Simple UI: unneccessary UI elements are removed in order to give user a simple and professional feel.
* It is open- source :smile:

Even though the project is open source, It is not recommended to create own instance of the project. If You want to check out the project you can click [here]() to see a live demo of the project.

Note: Due to limitations in hosting service, please allow upto 40 seconds for the UI to change after creating the room initally. The server spins down due to inactivity for a while.



### Built With

This section should list any major frameworks/libraries used to bootstrap your project. Leave any add-ons/plugins for the acknowledgements section. Here are a few examples.


* [![React][React.js]][React-url]
* [![Vite][Vitejs.dev]][Vite-url]
* [![Express][expressjs.com]][Expressjs-url]
* [![Socket.io][socket.io]][socket.io-url]
* [![WebRTC][webrtc.com]][webrtc-url]
* [![Nodejs][nodejs]][nodejs-url]
* [![Async_Queue][AsyncQueue.com]][npm-url]




<!-- GETTING STARTED -->
## Getting Started

Though it is not recommended creating a instance, feel free to fork the repo and try it out yourself. It not recommended to use this vesion if you intent to conduct meetings or calls that make have sensitive datas. Since the project is open source and is not strongly sercured, someone can still snoop into your calls. To further improve saftey consider adding [authentication for socket io](https://socket.io/docs/v4/server-api/#serverofnsp).

### Prerequisites
* Node
  #### Node installation on Windows

  Just go on [official Node.js website](https://nodejs.org/) and download the installer.
Also, be sure to have `git` available in your PATH, `npm` might need it (You can find git [here](https://git-scm.com/)).

  #### Node installation on Ubuntu

  You can install nodejs and npm easily with apt install, just run the following commands.

      $ sudo apt install nodejs
      $ sudo apt install npm

  #### Other Operating Systems
  You can find more information about the installation on the [official Node.js website](https://nodejs.org/) and the [official NPM website](https://npmjs.org/).

If the installation was successful, you should be able to run the following command.

    $ node --version
    v8.11.3

    $ npm --version
    6.1.0

If you need to update `npm`, you can make it using `npm`! After running the following command, just open again the command line.

    $ npm install npm -g


### Installation


1. Clone the repo
   ```sh
   git clone https://github.com/snowflake04/VI.mate.git
   ```

2. Start the server first. Navigate into `server` folder and run the following commands.
```sh
    # install required dependencies
   npm install

    # after it is complete start the server
    npm start
   ```
3. Start the frontend. Navigate into `vimate` and run the following commands.
   ```sh
   # install dependencies
   npm install

   #start frontend
   npm run dev
   ```
4. Navigate to `src/context.streamProvider.js` and replace the `server_url` with your server url. If you are running both server and frontend on localhost, leave it as is

5. enjoy :smile:

<!-- ROADMAP -->
## Roadmap

- [x] Add multiple client call
- [x] Add chat option
- [x] Add authentication for when user joins.
- [x] Add expanded and normal video screens
- [x] Add user Avatar
- [x] Add screenshare
- [x] Expand user stream on click
- [ ] Add private chat
- [ ] Add theme switching

See the [open issues](https://github.com/snowflake04/vi.mate/issues) for a full list of proposed features (and known issues).
>

<!-- CONTRIBUTING -->
## Contributing

Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".
Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


## Hosting
If you intend to host your instance, you will need a SSL Certificate on your domian in order for the app to work properly. Otherwise it is no possible to get video and audio sources of users.

<!-- LICENSE -->
## License

Distributed under the Apache License. See `LICENSE.txt` for more information.




<!-- CONTACT -->
## Support

If you like my project, consider supporting me by [Buying me a coffee](https://www.buymeacoffee.com/snowflake04)

<p align="right">(<a href="#readme-top"> Top </a>)</p>



<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/othneildrew/Best-README-Template.svg?style=for-the-badge
[contributors-url]: https://github.com/othneildrew/Best-README-Template/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/othneildrew/Best-README-Template.svg?style=for-the-badge
[forks-url]: https://github.com/snowflake04/mono/network/members
[stars-shield]: https://img.shields.io/github/stars/othneildrew/Best-README-Template.svg?style=for-the-badge
[stars-url]: https://github.com/othneildrew/Best-README-Template/stargazers
[issues-shield]: https://img.shields.io/github/issues/othneildrew/Best-README-Template.svg?style=for-the-badge
[issues-url]: https://github.com/othneildrew/Best-README-Template/issues
[license-shield]: https://img.shields.io/github/license/othneildrew/Best-README-Template.svg?style=for-the-badge
[license-url]: https://github.com/othneildrew/Best-README-Template/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/othneildrew
[product-screenshot]: images/screenshot.png
[expressjs.com]: https://img.shields.io/badge/Expressjs-000000?style=for-the-badge&logo=Expressjs&logoColor=white
[Expressjs-url]: https://expressjs.com/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Vitejs.dev]: https://img.shields.io/badge/Vite.js-35495E?style=for-the-badge&logo=vitejsdotdev&logoColor=4FC08D
[Vite-url]: https://vitejs.dev/
[socket.io]: https://img.shields.io/badge/Socket.io-DD0031?style=for-the-badge&logo=socketdotio&logoColor=white
[socket.io-url]: https://socket.io/
[webrtc.com]: https://img.shields.io/badge/WebRTC-4A4A55?style=for-the-badge&logo=webRTC&logoColor=FF3E00
[webrtc-url]: https://webrtc.com/
[nodejs]: https://img.shields.io/badge/nodejs-FF2D20?style=for-the-badge&logo=nodejsl&logoColor=white
[nodejs-url]: https://nodejs.org
[asyncQueue.com]: https://img.shields.io/badge/AsyncQueue-563D7C?style=for-the-badge&logo=asyncqueue&logoColor=white
[npm-url]: https://www.npmjs.com/package/@snowflake04/async-queue
 
