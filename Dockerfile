# Create image based on the official Node image from dockerhub
FROM node:18

# Create base directory
WORKDIR /usr/src/hubspot-cli

# Get all the code needed to run the app locally
COPY . .

# Install dependencies
RUN yarn

# HACK https://unix.stackexchange.com/questions/63979/shebang-line-with-usr-bin-env-command-argument-fails-on-linux
#RUN sed -i 's/--no-deprecation//g' hubspot-cli/packages/cli/bin/hs

# Execute tests
RUN yarn test
