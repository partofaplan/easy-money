# Build the static site, then serve it with nginx. Cloud Run runs the result.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Cloud Run sends traffic to $PORT (8080 by default).
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
