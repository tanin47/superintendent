FROM electronuserland/builder:wine
RUN apt update && apt -y install default-jre
RUN npm install -g corepack
RUN rm -f /usr/bin/yarn
ENV PAHT="$PATH:/usr/local/bin"