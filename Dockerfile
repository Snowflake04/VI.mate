
RUN cd server && npm install
RUN cd client && npm install
CMD node ./server/index.js & cd/client; npm start
