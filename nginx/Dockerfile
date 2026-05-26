FROM nginx:alpine

# Install OpenSSL to dynamically generate self-signed TLS certificates
RUN apk add --no-cache openssl

RUN mkdir -p /etc/nginx/ssl

# Dynamically compile standard local/internal self-signed certificates
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "/C=IN/ST=Delhi/L=Delhi/O=DRDO/OU=DEAL/CN=localhost"

# Copy configurations
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
