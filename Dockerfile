# Create image based on the official Node image from dockerhub
FROM node:16

# Create base directory
WORKDIR /usr/src/hubspot-cli

# Get all the code needed to run the app locally
COPY . .

# Install dependencies
RUN yarn
