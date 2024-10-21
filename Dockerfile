# Create image based on the official Node image from dockerhub
FROM node:18

# Create base directory
WORKDIR /usr/src/hubspot-cli

RUN npm install -g @hubspot/cli@latest

# Get all the code needed to run the app locally
COPY . ./

# Expose the ports for UIE Local dev
EXPOSE 5173
EXPOSE 5174

# Expose the port for the PortManager
EXPOSE 8080

# Install dependencies
RUN yarn