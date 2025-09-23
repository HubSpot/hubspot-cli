# Create image based on the official Node image from dockerhub
FROM node:18

# Create base directory
WORKDIR /usr/src/hubspot-cli

# Set environment variables from build args
#ENV ACCOUNT_ID=
#ENV QA=
#ENV PERSONAL_ACCESS_KEY=

RUN npm install -g @hubspot/cli@latest

# Get all the code needed to run the app locally
COPY . ./

# Remove node_modules
RUN rm -rf node_modules
RUN rm -rf acceptance-tests/node_modules

# Install dependencies
RUN yarn install --force
RUN yarn install --force --cwd acceptance-tests

# Expose the ports for UIE Local dev
EXPOSE 5173
EXPOSE 5174

# Expose the port for the PortManager
EXPOSE 8080
