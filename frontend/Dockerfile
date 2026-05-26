# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Serve built assets using NGINX Alpine
FROM nginx:alpine

# Copy built artifacts to standard NGINX path
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom light NGINX config for frontend routing fallback (Single Page App)
RUN echo 'server { \
    listen 3000; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
