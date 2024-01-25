# Use Node.js LTS version
FROM node:21
RUN npm install -g npm@latest

# Create app directory
WORKDIR client




# Install client and server dependencies
COPY package*.json ./
RUN npm cache clean --force
RUN npm install 

# Bundle client dependencies
COPY . .
RUN npm run build


WORKDIR /server

# Install client and server dependencies
COPY package*.json ./
RUN npm cache clean --force
RUN npm install

# Bundle client dependencies
COPY . .
RUN npm run build

# Define environment variables
ENV NODE_ENV=production

# Expose server port
EXPOSE 8000

# Start server and client
CMD [ "nodemon", "index.js" ] && [ "npm", "start" ]
