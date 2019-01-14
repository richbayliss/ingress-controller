FROM balenalib/intel-nuc-alpine-node

RUN apk add haproxy supervisor

WORKDIR /usr/src/app/ingress-controller-parser
COPY ingress-controller-parser/package.json ./
RUN npm i --production
COPY ingress-controller-parser ./

WORKDIR /usr/src/app/config-builder
COPY config-builder/package.json ./
RUN npm i --production
COPY config-builder ./

WORKDIR /usr/src/app
RUN npm i ingress-controller-parser -g && \
    npm i config-builder -g

COPY startup.sh .
RUN chmod a+x ./startup.sh

COPY supervisord.conf /etc/supervisord.conf

VOLUME [ "/usr/src/app/certs" ]

CMD [ "./startup.sh" ]